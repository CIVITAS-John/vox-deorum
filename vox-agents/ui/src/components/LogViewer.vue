<template>
  <div class="flex align-items-center gap-2">
    <h1>Real-time Logs</h1>
    <Tag :severity="isConnected ? 'success' : 'warn'">
      {{ isConnected ? 'Connected' : 'Disconnected' }}
    </Tag>
    <Tag severity="info">{{ filteredLogs.length }}/{{ logs.length }} Logs</Tag>
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

      <div v-if="filteredLogs.length === 0" class="table-empty">
        <i class="pi pi-inbox"></i>
        <p>No log entries to display</p>
        <p class="text-small text-muted">Logs will appear here as the application runs</p>
      </div>

      <div v-else class="data-table log-container" ref="logContainer">
        <!-- Header row -->
        <div class="table-header">
          <div class="col-fixed-100">Time</div>
          <div class="col-fixed-150">Level</div>
          <div class="col-expand">Message</div>
        </div>

        <!-- Log entries using Virtua VList -->
        <VList
          :data="filteredLogs"
          :style="{ height: scrollerHeight }"
          ref="virtualScroller"
          class="table-body log-scroller"
          #default="{ item, index }"
        >
          <div :key="`${item.timestamp}-${index}`"
               :class="getLogRowClass(item.level)">
            <div class="col-fixed-100">{{ formatTimestamp(item.timestamp) }}</div>
            <div class="col-fixed-150">
              <span class="level-emoji">{{ getLevelEmoji(item.level) }}</span>
              <span class="level-source text-muted text-small">{{ item.context }}</span>
            </div>
            <div class="col-expand text-wrap">
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

// Get appropriate row class based on log level
const getLogRowClass = (level: string) => {
  const baseClass = 'table-row';
  switch(level) {
    case 'error':
      return `${baseClass} error`;
    case 'warn':
      return `${baseClass} warning`;
    default:
      return baseClass;
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
@import '@/styles/data-table.css';

/* LogViewer specific overrides */
.log-container {
  /* Override max-height from data-table.css for adaptive height */
}

.log-container .table-body {
  max-height: none; /* Remove max-height as we control it via scrollerHeight */
}

/* Log-specific styling */
.level-emoji {
  margin-right: 0.25rem;
}

.level-source {
  margin-left: 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Params container styling */
.params-list {
  color: var(--text-color-secondary);
  display: block;
  font-size: 0.75rem;
  margin-top: 0.25rem;
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

/* Log level specific text colors */
.table-row.error {
  color: var(--red-700);
}

.table-row.warning {
  color: var(--yellow-700);
}

/* Dark mode adjustments */
@media (prefers-color-scheme: dark) {
  .table-row.error {
    color: var(--red-300);
  }

  .table-row.warning {
    color: var(--yellow-300);
  }
}
</style>