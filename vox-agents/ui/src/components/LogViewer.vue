<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue';
import { apiClient, type LogEntry } from '../api/client';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import SelectButton from 'primevue/selectbutton';
import Card from 'primevue/card';
import Toolbar from 'primevue/toolbar';
import Tag from 'primevue/tag';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import ScrollPanel from 'primevue/scrollpanel';

// Log storage and display
const logs = ref<LogEntry[]>([]);
const maxLogs = 1000; // Buffer limit

// Filtering
const searchQuery = ref('');
const selectedLevel = ref<string | null>(null);
const selectedSource = ref<string | null>(null);

// UI state
const autoscroll = ref(true);
const isPaused = ref(false);
const isConnected = ref(false);
const logContainer = ref<any>();

// SSE cleanup function
let cleanupSse: (() => void) | null = null;

// Log level options
const logLevels = [
  { label: 'All', value: null },
  { label: 'Error', value: 'error' },
  { label: 'Warn', value: 'warn' },
  { label: 'Info', value: 'info' },
  { label: 'Debug', value: 'debug' }
];

// Source filter options (dynamically populated)
const sourcesSet = ref(new Set<string>());
const sourceOptions = computed(() => {
  const options: Array<{ label: string; value: string | null }> = [
    { label: 'All Sources', value: null }
  ];
  for (const source of sourcesSet.value) {
    options.push({ label: source, value: source });
  }
  return options;
});

// Filtered logs
const filteredLogs = computed(() => {
  return logs.value.filter(log => {
    // Level filter
    if (selectedLevel.value && log.level !== selectedLevel.value) {
      return false;
    }

    // Source filter
    if (selectedSource.value && log.source !== selectedSource.value) {
      return false;
    }

    // Search filter
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      return (
        log.message.toLowerCase().includes(query) ||
        (log.source && log.source.toLowerCase().includes(query))
      );
    }

    return true;
  });
});

// Add new log entry
const addLog = (log: LogEntry) => {
  if (isPaused.value) return;

  // Add source to set
  if (log.source) {
    sourcesSet.value.add(log.source);
  }

  // Add to logs array
  logs.value.push(log);

  // Trim if exceeds max
  if (logs.value.length > maxLogs) {
    logs.value.shift();
  }

  // Auto-scroll if enabled
  if (autoscroll.value) {
    nextTick(() => {
      scrollToBottom();
    });
  }
};

// Scroll to bottom
const scrollToBottom = () => {
  if (logContainer.value?.$el) {
    const scrollContent = logContainer.value.$el.querySelector('.p-scrollpanel-content');
    if (scrollContent) {
      scrollContent.scrollTop = scrollContent.scrollHeight;
    }
  }
};

// Clear logs
const clearLogs = () => {
  logs.value = [];
  sourcesSet.value.clear();
};

// Toggle pause
const togglePause = () => {
  isPaused.value = !isPaused.value;
};

// Connect to SSE stream
const connectToStream = () => {
  cleanupSse = apiClient.streamLogs(
    (log) => {
      if (log) addLog(log);
      isConnected.value = true;
    },
    (error) => {
      console.error('Log stream error:', error);
      isConnected.value = false;
    }
  );
  isConnected.value = true;
};

// Get log severity for PrimeVue Tag
const getLogSeverity = (level: string): 'danger' | 'warn' | 'info' | 'secondary' => {
  switch (level) {
    case 'error':
      return 'danger';
    case 'warn':
      return 'warn';
    case 'info':
      return 'info';
    case 'debug':
    default:
      return 'secondary';
  }
};

// Format timestamp
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

// Highlight search term in text
const highlightText = (text: string) => {
  if (!searchQuery.value) return text;

  const query = searchQuery.value;
  const regex = new RegExp(`(${query})`, 'gi');
  return text.replace(regex, '<mark style="background: var(--primary-color); color: var(--primary-color-text);">$1</mark>');
};

onMounted(() => {
  connectToStream();
});

onUnmounted(() => {
  if (cleanupSse) {
    cleanupSse();
  }
});
</script>

<template>
  <Card class="h-full">
    <template #title>
      <div class="flex align-items-center justify-content-between">
        <div class="flex align-items-center gap-2">
          <h3>Real-time Logs</h3>
          <Tag
            :severity="isConnected ? 'success' : 'warn'"
            :icon="isConnected ? 'pi pi-circle-fill' : 'pi pi-circle'"
          >
            {{ isConnected ? 'Connected' : 'Disconnected' }}
          </Tag>
        </div>
      </div>
    </template>

    <template #content>
      <!-- Controls Toolbar -->
      <Toolbar class="mb-3">
        <template #start>
          <!-- Search -->
          <IconField iconPosition="left" class="mr-2">
            <InputIcon>
              <i class="pi pi-search" />
            </InputIcon>
            <InputText
              v-model="searchQuery"
              placeholder="Search logs..."
              style="width: 15rem"
            />
          </IconField>

          <!-- Level Filter -->
          <SelectButton
            v-model="selectedLevel"
            :options="logLevels"
            optionLabel="label"
            optionValue="value"
            class="mr-2"
          />

          <!-- Source Filter -->
          <SelectButton
            v-model="selectedSource"
            :options="sourceOptions"
            optionLabel="label"
            optionValue="value"
            v-if="sourcesSet.size > 0"
          />
        </template>

        <template #end>
          <!-- Action Buttons -->
          <Button
            :icon="isPaused ? 'pi pi-play' : 'pi pi-pause'"
            @click="togglePause"
            :label="isPaused ? 'Resume' : 'Pause'"
            severity="secondary"
            class="mr-2"
          />

          <Button
            :icon="autoscroll ? 'pi pi-lock' : 'pi pi-lock-open'"
            @click="autoscroll = !autoscroll"
            :label="autoscroll ? 'Auto' : 'Manual'"
            severity="secondary"
            class="mr-2"
          />

          <Button
            icon="pi pi-trash"
            @click="clearLogs"
            label="Clear"
            severity="danger"
          />
        </template>
      </Toolbar>

      <!-- Logs Container -->
      <ScrollPanel ref="logContainer" style="height: 500px" class="border-1 surface-border border-round">
        <div v-if="filteredLogs.length === 0" class="text-center p-5 text-500">
          <i class="pi pi-inbox text-4xl mb-3 block" />
          <p>{{ logs.length === 0 ? 'No logs yet' : 'No logs match filters' }}</p>
        </div>
        <div v-else class="p-2">
          <div
            v-for="(log, index) in filteredLogs"
            :key="index"
            class="flex gap-2 p-1 border-bottom-1 surface-border"
            style="font-family: monospace; font-size: 0.875rem;"
          >
            <span class="text-500 white-space-nowrap">{{ formatTimestamp(log.timestamp) }}</span>
            <Tag :severity="getLogSeverity(log.level)" style="min-width: 60px; text-align: center;">
              {{ log.level.toUpperCase() }}
            </Tag>
            <span class="text-orange-500" v-if="log.source">[{{ log.source }}]</span>
            <span class="flex-1 text-color" style="word-break: break-word;" v-html="highlightText(log.message)"></span>
          </div>
        </div>
      </ScrollPanel>

      <!-- Status Bar -->
      <div class="flex justify-content-between align-items-center mt-2 p-2 surface-ground border-round">
        <span class="text-500 text-sm">{{ filteredLogs.length }} / {{ logs.length }} logs</span>
        <Tag v-if="isPaused" severity="warn" icon="pi pi-pause">
          Paused
        </Tag>
      </div>
    </template>
  </Card>
</template>