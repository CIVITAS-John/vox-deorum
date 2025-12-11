<template>
  <div class="flex align-items-center gap-2">
    <h1>Real-time Logs</h1>
    <Tag :severity="isConnected ? 'success' : 'warn'">
      {{ isConnected ? 'Connected' : 'Disconnected' }}
    </Tag>
    <Tag severity="info">{{ filteredLogs.length }}/{{ logs.length }} logs</Tag>
  </div>

  <Card class="h-full">
    <template #content>
      <div class="flex gap-2 mb-3 align-items-center">
        <SelectButton
          v-model="selectedLevel"
          :options="[
            { label: 'Debug', value: 'debug' },
            { label: 'Info', value: 'info' },
            { label: 'Warn', value: 'warn' },
            { label: 'Error', value: 'error' }
          ]"
          optionLabel="label"
          optionValue="value"
          size="small"
        />
        <div class="mx-2">
          <ToggleButton
            v-model="hideWebUI"
            on-label="Hide WebUI"
            off-label="Show WebUI"
            on-icon="pi pi-eye-slash"
            off-icon="pi pi-eye"
            size="small"
          />
        </div>
        <Button
          :icon="autoscroll ? 'pi pi-lock' : 'pi pi-lock-open'"
          @click="autoscroll = !autoscroll"
          label="Auto-scroll"
          severity="secondary"
          size="small"
        />
        <Button
          icon="pi pi-trash"
          @click="clearLogs"
          label="Clear"
          severity="danger"
          size="small"
        />
      </div>

      <div class="log-container">
        <!-- Header row -->
        <div class="log-header">
          <div class="col-time">Time</div>
          <div class="col-level">Level</div>
          <div class="col-message">Message</div>
        </div>

        <!-- Log entries -->
        <VirtualScroller
          :items="filteredLogs"
          :itemSize="40"
          :scrollHeight="scrollerHeight"
          ref="virtualScroller"
          class="log-scroller"
        >
          <template v-slot:item="{ item }">
            <div :class="`log-row log-${item.level}`">
              <div class="col-time">{{ formatTimestamp(item.timestamp) }}</div>
              <div class="col-level">
                <span class="level-emoji">{{ getLevelEmoji(item.level) }}</span>
                <span class="level-source">{{ item.context }}</span>
              </div>
              <div class="col-message">
                {{ item.message }}
                <div v-if="hasParams(item)" class="params-list">
                  <ParamsList :params="item.params" :depth="0" />
                </div>
              </div>
            </div>
          </template>
        </VirtualScroller>
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue';
import { logs, isConnected, clearLogs as clearLogsStore } from '../stores/logs';
import { hasParams, getLevelEmoji, formatTimestamp, levelHierarchy } from '../api/log-utils';
import VirtualScroller from 'primevue/virtualscroller';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Tag from 'primevue/tag';
import ToggleButton from 'primevue/togglebutton';
import SelectButton from 'primevue/selectbutton';
import ParamsList from './ParamsList.vue';
import '/node_modules/primeflex/primeflex.css'

// State
const autoscroll = ref(true);
const hideWebUI = ref(true);
const selectedLevel = ref('info');
const virtualScroller = ref<any>();
const scrollerHeight = ref('600px');

// Calculate adaptive scroll height
const calculateScrollerHeight = () => {
  // Get viewport height and subtract approximate space for header, controls, padding
  const viewportHeight = window.innerHeight;
  const headerAndControlsHeight = 250; // Approximate height for header, controls, and padding
  const calculatedHeight = Math.max(400, viewportHeight - headerAndControlsHeight); // Minimum 400px
  scrollerHeight.value = `${calculatedHeight}px`;
};

// Update height on window resize
const handleResize = () => {
  calculateScrollerHeight();
};

// Filtered logs based on level and source
const filteredLogs = computed(() => {
  return logs.value.filter(log => {
    // Filter by level hierarchy
    const logLevel = levelHierarchy[log.level] ?? 0;
    const minLevel = levelHierarchy[selectedLevel.value] ?? 0;
    if (logLevel < minLevel) return false;

    // Filter out webui if needed
    if (hideWebUI.value && log.webui) return false;

    return true;
  });
});

// Watch for new logs to handle autoscroll
watch(filteredLogs, (newLogs, oldLogs) => {
  // Only autoscroll if there are new logs
  if (autoscroll.value && virtualScroller.value && newLogs.length > oldLogs?.length) {
    nextTick(() => {
      const targetIndex = newLogs.length - 1;
      if (targetIndex >= 0) {
        requestAnimationFrame(() => {
          virtualScroller.value.scrollToIndex(targetIndex, 'auto');
        });
      }
    });
  }
});

// Use the store's clear function
const clearLogs = () => clearLogsStore();

onMounted(() => {
  calculateScrollerHeight();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});
</script>

<style scoped>
.log-container {
  border: 1px solid var(--p-surface-200);
  border-radius: var(--p-border-radius-md);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.log-header {
  display: flex;
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--p-content-hover-background);
  border-bottom: 2px solid var(--p-content-border-color);
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--p-text-color);
}

.log-header > div {
  padding: 0.5rem;
}

.log-row {
  display: flex;
  align-items: flex-start;
  transition: background-color 0.1s;
  border-bottom: 1px solid var(--p-content-border-color);
  background: var(--p-content-background);
}

.log-row:hover {
  background: var(--p-content-hover-background);
}


.log-row > div {
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
}

/* Log level specific colors using extended PrimeVue color palette */
.log-debug {
  color: var(--p-text-muted-color);
}

.log-warn {
  color: var(--p-amber-700);
  background: var(--p-amber-50);
}

.log-warn:hover {
  background: var(--p-amber-100);
}

.log-error {
  color: var(--p-red-700);
  background: var(--p-red-50);
}

.log-error:hover {
  background: var(--p-red-100);
}

/* Dark mode versions */
.dark-mode .log-warn {
  color: var(--p-amber-300);
  background: var(--p-amber-950);
}

.dark-mode .log-warn:hover {
  background: var(--p-amber-900);
}

.dark-mode .log-error {
  color: var(--p-red-300);
  background: var(--p-red-950);
}

.dark-mode .log-error:hover {
  background: var(--p-red-900);
}

/* Column widths */
.col-time {
  flex: 0 0 100px;
  white-space: nowrap;
}

.col-level {
  flex: 0 0 150px;
  display: flex;
  align-items: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col-message {
  flex: 1;
  word-wrap: break-word;
  white-space: pre-wrap;
  word-break: break-word;
  min-width: 0; /* Allow flex item to shrink below content size */
}

.level-emoji {
  margin-right: 0.25rem;
}

.level-source {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-scroller {
  background: var(--p-surface-50);
}

/* Params container styling */
.params-list {
  color: var(--p-text-muted-color);
  display: block;
  font-size: 0.75rem;
}
</style>