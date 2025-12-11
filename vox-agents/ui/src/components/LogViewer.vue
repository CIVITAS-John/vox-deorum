<template>
  <Card class="h-full">
    <template #title>
      <div class="flex align-items-center gap-2">
        <h3>Real-time Logs</h3>
        <Tag :severity="isConnected ? 'success' : 'warn'">
          {{ isConnected ? 'Connected' : 'Disconnected' }}
        </Tag>
        <Tag severity="info">{{ filteredLogs.length }}/{{ logs.length }} logs</Tag>
      </div>
    </template>

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
              <div class="col-message">{{ item.message }}</div>
            </div>
          </template>
        </VirtualScroller>
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue';
import { apiClient, type LogEntry } from '../api/client';
import VirtualScroller from 'primevue/virtualscroller';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Tag from 'primevue/tag';
import ToggleButton from 'primevue/togglebutton';
import SelectButton from 'primevue/selectbutton';
import '/node_modules/primeflex/primeflex.css'

// State
const logs = ref<LogEntry[]>([]);
const isConnected = ref(false);
const autoscroll = ref(true);
const hideWebUI = ref(true);
const selectedLevel = ref('info');
const virtualScroller = ref<any>();
const scrollerHeight = ref('600px');

let cleanupSse: (() => void) | null = null;
const MAX_LOGS = 1000;

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

// Log level hierarchy
const levelHierarchy: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
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

// Helper functions
const getLevelEmoji = (level: string) => ({
  error: '❌',
  warn: '⚠️',
  info: 'ℹ️',
  debug: '🐛'
}[level] || '📝');

const formatTimestamp = (timestamp: string) => {
  try {
    const date = new Date(timestamp);
    const time = date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    return `${time}.${ms}`;
  } catch {
    return timestamp;
  }
};

// Log management
const addLog = (log: LogEntry) => {
  logs.value.push(log);
  if (logs.value.length > MAX_LOGS) {
    logs.value = logs.value.slice(-MAX_LOGS);
  }

  if (autoscroll.value && virtualScroller.value) {
    nextTick(() => {
      const scrollElement = virtualScroller.value.$el;
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    });
  }
};

const clearLogs = () => logs.value = [];

// SSE connection
const connectToStream = () => {
  cleanupSse = apiClient.streamLogs(
    (log) => {
      addLog(log);
      isConnected.value = true;
    },
    (error) => {
      console.error('Log stream error:', error);
      isConnected.value = false;
    },
    () => isConnected.value = true
  );
};

onMounted(() => {
  connectToStream();
  calculateScrollerHeight();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  cleanupSse?.();
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
  background: var(--p-surface-100);
  border-bottom: 2px solid var(--p-surface-200);
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
  border-bottom: 1px solid var(--p-surface-200);
  background: var(--p-surface-0);
}

.log-row > div {
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
}

/* Log level specific colors using extended PrimeVue color palette */
.log-debug {
  color: var(--p-slate-600);
  background: var(--p-slate-50);
}

.log-debug:hover {
  background: var(--p-slate-100);
}

.log-info:hover {
  background: var(--p-primary-100);
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
</style>