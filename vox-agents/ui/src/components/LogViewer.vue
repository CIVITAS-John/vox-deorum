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
          :icon="isPaused ? 'pi pi-play' : 'pi pi-pause'"
          @click="togglePause"
          :label="isPaused ? 'Resume' : 'Pause'"
          severity="secondary"
          size="small"
        />
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

      <div class="log-table-container">
        <table class="log-table">
          <thead>
            <tr>
              <th class="col-time">Time</th>
              <th class="col-level">Level</th>
              <th class="col-message">Message</th>
            </tr>
          </thead>
        </table>

        <VirtualScroller
          :items="filteredLogs"
          :itemSize="40"
          scrollHeight="600px"
          ref="virtualScroller"
          class="log-scroller"
        >
          <template v-slot:item="{ item }">
            <table class="log-table">
              <tbody>
                <tr :class="`log-row log-${item.level}`">
                  <td class="col-time">{{ formatTimestamp(item.timestamp) }}</td>
                  <td class="col-level">
                    <span class="level-emoji">{{ getLevelEmoji(item.level) }}</span>
                    <span class="level-source">{{ item.context }}</span>
                  </td>
                  <td class="col-message">{{ item.message }}</td>
                </tr>
              </tbody>
            </table>
          </template>
        </VirtualScroller>
      </div>

      <div class="flex align-items-center justify-content-end mt-2">
        <Tag v-if="isPaused" severity="warn">Paused</Tag>
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

// State
const logs = ref<LogEntry[]>([]);
const isPaused = ref(false);
const isConnected = ref(false);
const autoscroll = ref(true);
const hideWebUI = ref(true);
const selectedLevel = ref('info');
const virtualScroller = ref<any>();

let cleanupSse: (() => void) | null = null;
const MAX_LOGS = 1000;

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
  if (isPaused.value) return;

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
const togglePause = () => isPaused.value = !isPaused.value;

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

onMounted(connectToStream);
onUnmounted(() => cleanupSse?.());
</script>

<style scoped>
.log-table-container {
  border: 1px solid var(--surface-border);
  border-radius: var(--border-radius);
  overflow: hidden;
}

.log-table {
  width: 100%;
  line-height: 150%;
  border-collapse: collapse;
  table-layout: fixed;
}

.log-table thead {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--surface-section);
}

.log-table th {
  padding: 0.5rem;
  text-align: left;
  font-weight: 600;
  font-size: 0.875rem;
  border-bottom: 2px solid var(--surface-border);
  background: var(--surface-card);
}

.log-table td {
  padding: 0.25rem 0.5rem;
  font-size: 0.813rem;
  vertical-align: top;
  border-bottom: 1px solid var(--surface-border);
}

.col-time {
  width: 120px;
  font-family: monospace;
  color: var(--text-color-secondary);
  white-space: nowrap;
}

.col-level {
  width: 150px;
  white-space: nowrap;
}

.col-message {
  word-wrap: break-word;
  white-space: pre-wrap;
  word-break: break-word;
}

.level-emoji {
  margin-right: 0.25rem;
  font-size: 1rem;
}

.level-source {
  color: var(--text-color-secondary);
  font-size: 0.75rem;
}

.log-scroller {
  background: var(--surface-ground);
}

/* Log level row colors - using PrimeVue theme variables */
.log-row {
  transition: background-color 0.1s;
}

.log-row:hover {
  background: var(--surface-hover);
}

.log-debug {
  background: color-mix(in srgb, var(--gray-500) 5%, transparent);
}

.log-info {
  background: transparent;
}

.log-warn {
  background: color-mix(in srgb, var(--yellow-500) 10%, transparent);
}

.log-error {
  background: color-mix(in srgb, var(--red-500) 10%, transparent);
}

/* Override PrimeVue VirtualScroller styles */
:deep(.p-virtualscroller) {
  border: none;
}

:deep(.p-virtualscroller-content) {
  background: var(--surface-ground);
}

:deep(.p-virtualscroller-item) {
  padding: 0;
}
</style>