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
          <MultiSelect
            v-model="selectedSources"
            :options="sourceOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="All Sources"
            display="chip"
            size="small"
            :showToggleAll="false"
            class="source-filter"
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

      <div class="log-container" ref="logContainer">
        <!-- Header row -->
        <div class="log-header">
          <div class="col-time">Time</div>
          <div class="col-level">Level</div>
          <div class="col-message">Message</div>
        </div>

        <!-- Log entries using Virtua VList -->
        <VList
          :data="filteredLogs"
          :style="{ height: scrollerHeight }"
          ref="virtualScroller"
          class="log-scroller"
          #default="{ item, index }"
        >
          <div :key="`${item.timestamp}-${index}`" :class="`log-row log-${item.level}`">
            <div class="col-time">{{ formatTimestamp(item.timestamp) }}</div>
            <div class="col-level">
              <span class="level-emoji">{{ getLevelEmoji(item.level) }}</span>
              <span class="level-source">{{ item.context }}</span>
            </div>
            <div class="col-message">
              {{ item.message }}
              <div v-if="item.params" class="params-list">
                <ParamsList :params="item.params" :depth="0" />
              </div>
            </div>
          </div>
        </VList>
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue';
import { logs, isConnected, clearLogs as clearLogsStore } from '../stores/logs';
import { getLevelEmoji, formatTimestamp, levelHierarchy, calculateMessageCharWidth } from '../api/log-utils';
import { VList } from 'virtua/vue';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Tag from 'primevue/tag';
import MultiSelect from 'primevue/multiselect';
import SelectButton from 'primevue/selectbutton';
import ParamsList from './ParamsList.vue';
import '/node_modules/primeflex/primeflex.css'

// State
const autoscroll = ref(true);
const selectedSources = ref<string[]>(['agents', 'webui']); // Show all sources by default
const selectedLevel = ref('info');

// Source options for the multi-select
const sourceOptions = [
  { label: 'Agents', value: 'agents' },
  { label: 'WebUI', value: 'webui' }
];
const virtualScroller = ref<any>();
const logContainer = ref<HTMLElement>();
const scrollerHeight = ref('600px');
const messageFieldWidth = ref(100);

// Calculate adaptive scroll height
const calculateScrollerHeight = () => {
  // Get viewport height and subtract approximate space for header, controls, padding
  const viewportHeight = window.innerHeight;
  const headerAndControlsHeight = 250; // Approximate height for header, controls, and padding
  const calculatedHeight = Math.max(400, viewportHeight - headerAndControlsHeight); // Minimum 400px
  scrollerHeight.value = `${calculatedHeight}px`;
};

// Update message field width based on container
const updateMessageFieldWidth = () => {
  if (logContainer.value) {
    const containerWidth = logContainer.value.offsetWidth;
    messageFieldWidth.value = calculateMessageCharWidth(containerWidth);
  }
};

// Debounce timer
let resizeTimer: ReturnType<typeof setTimeout> | null = null;

// Update dimensions on window resize with debounce
const handleResize = () => {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    calculateScrollerHeight();
    updateMessageFieldWidth();
  }, 150); // Debounce for 150ms
};

// Filtered logs based on level and source
const filteredLogs = computed(() => {
  return logs.value.filter(log => {
    // Filter by level hierarchy
    const logLevel = levelHierarchy[log.level] ?? 0;
    const minLevel = levelHierarchy[selectedLevel.value] ?? 0;
    if (logLevel < minLevel) return false;

    // Filter by source if specific sources are selected
    if (selectedSources.value.length > 0) {
      const logSource = log.source || 'agents'; // Default to 'agents' if no source
      if (!selectedSources.value.includes(logSource)) return false;
    }

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
          // Virtua uses scrollToIndex method directly on the ref
          virtualScroller.value.scrollToIndex(targetIndex);
        });
      }
    });
  }

  // Update width calculation when logs change (container might resize)
  if (newLogs.length !== oldLogs?.length) {
    nextTick(() => {
      updateMessageFieldWidth();
    });
  }
});

// Use the store's clear function
const clearLogs = () => clearLogsStore();

onMounted(() => {
  calculateScrollerHeight();
  // Wait for next tick to ensure container is rendered
  nextTick(() => {
    updateMessageFieldWidth();
  });
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
  min-height: 32px; /* Ensure minimum height */
  box-sizing: border-box; /* Include padding in height calculation */
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

/* Params container styling */
.params-list {
  color: var(--p-text-muted-color);
  display: block;
  font-size: 0.75rem;
}

/* Virtua VList optimization */
.log-scroller {
  will-change: scroll-position; /* Hint browser for optimization */
  transform: translateZ(0); /* Enable hardware acceleration */
  backface-visibility: hidden; /* Prevent flickering */
}

/* Multi-select source filter styling */
.source-filter {
  min-width: 150px;
  max-width: 250px;
}

.source-filter :deep(.p-multiselect-label) {
  padding: 0.375rem 0.5rem;
  font-size: 0.875rem;
}
</style>