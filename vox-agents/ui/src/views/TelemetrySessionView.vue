<script setup lang="ts">
/**
 * TelemetrySessionView - View active telemetry session with real-time span streaming
 * Shows live spans from an active telemetry session with virtual scrolling
 */

import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { VList } from 'virtua/vue';
import Card from 'primevue/card';
import Button from 'primevue/button';
import ToggleButton from 'primevue/togglebutton';
import Tag from 'primevue/tag';
import ProgressSpinner from 'primevue/progressspinner';
import { api } from '@/api/client';
import type { Span, SpanStreamEvent } from '@/api/types';
import {
  formatSpanLine,
  getSpanRowClass
} from '@/api/telemetry-utils';

const route = useRoute();
const router = useRouter();

// State
const loading = ref(true);
const error = ref<string | null>(null);
const spans = ref<Span[]>([]);
const connectionStatus = ref<'connecting' | 'connected' | 'disconnected'>('connecting');
const autoScroll = ref(true);
const maxSpans = 1000; // Rolling window size
let cleanupStream: (() => void) | null = null;
let lastHeartbeat = ref(Date.now());

// Extract session ID from route params
const sessionId = computed(() => route.params.sessionId as string);

/**
 * Connection status tag severity
 */
const connectionSeverity = computed(() => {
  switch (connectionStatus.value) {
    case 'connected': return 'success';
    case 'connecting': return 'warning';
    case 'disconnected': return 'danger';
  }
});

/**
 * Connection status text
 */
const connectionText = computed(() => {
  switch (connectionStatus.value) {
    case 'connected': return 'Connected';
    case 'connecting': return 'Connecting...';
    case 'disconnected': return 'Disconnected';
  }
});

/**
 * Clear all spans
 */
function clearSpans() {
  spans.value = [];
}

/**
 * Go back to telemetry main view
 */
function goBack() {
  router.push({ name: 'telemetry' });
}

/**
 * Load initial spans from the session
 */
async function loadInitialSpans() {
  try {
    const response = await api.getSessionSpans(sessionId.value);
    spans.value = response.spans.slice(-maxSpans); // Keep only latest spans
    loading.value = false;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load session spans';
    console.error('Error loading spans:', err);
    loading.value = false;
  }
}

/**
 * Setup SSE stream for real-time span updates
 */
function setupSpanStream() {
  connectionStatus.value = 'connecting';

  cleanupStream = api.streamSessionSpans(
    sessionId.value,
    // On span data
    (data: SpanStreamEvent) => {
      if (data.spans && data.spans.length > 0) {
        // Add new spans to the array
        spans.value.push(...data.spans);

        // Maintain rolling window
        if (spans.value.length > maxSpans) {
          spans.value = spans.value.slice(-maxSpans);
        }

        // Auto-scroll if enabled
        if (autoScroll.value) {
          setTimeout(() => {
            const container = document.querySelector('.virtua-scroller');
            if (container) {
              container.scrollTop = container.scrollHeight;
            }
          }, 50);
        }
      }
      connectionStatus.value = 'connected';
    },
    // On error
    (error) => {
      console.error('SSE error:', error);
      connectionStatus.value = 'disconnected';

      // Try to reconnect after 3 seconds
      setTimeout(() => {
        if (cleanupStream) {
          cleanupStream();
        }
        setupSpanStream();
      }, 3000);
    },
    // On heartbeat
    () => {
      lastHeartbeat.value = Date.now();
      connectionStatus.value = 'connected';
    }
  );
}

// Monitor heartbeat timeout
let heartbeatInterval: number | null = null;
function startHeartbeatMonitor() {
  heartbeatInterval = window.setInterval(() => {
    // If no heartbeat for 45 seconds, mark as disconnected
    if (Date.now() - lastHeartbeat.value > 45000) {
      connectionStatus.value = 'disconnected';
    }
  }, 5000);
}

onMounted(() => {
  // Load initial spans first
  loadInitialSpans();
  // Then setup streaming
  setupSpanStream();
  // Monitor heartbeats
  startHeartbeatMonitor();
});

onUnmounted(() => {
  // Cleanup SSE connection
  if (cleanupStream) {
    cleanupStream();
  }

  // Clear heartbeat monitor
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
});
</script>

<template>
  <div class="telemetry-session-view">
    <!-- Header with navigation -->
    <div class="view-header">
      <Button
        icon="pi pi-arrow-left"
        text
        rounded
        @click="goBack"
        class="back-button"
      />
      <div class="header-info">
        <h1>Session {{ sessionId }}</h1>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <ProgressSpinner />
      <p>Loading session spans...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-container">
      <i class="pi pi-exclamation-triangle"></i>
      <p>{{ error }}</p>
      <Button label="Go Back" @click="goBack" />
    </div>

    <!-- Span Viewer -->
    <Card v-else class="span-viewer-container">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <h2>Live Spans</h2>
            <Tag :value="`${spans.length} spans`" />
            <Tag
              v-if="spans.length >= maxSpans"
              value="Window Full"
              severity="warning"
            />
          </div>
          <div class="header-right">
            <ToggleButton
              v-model="autoScroll"
              onLabel="Auto-scroll"
              offLabel="Auto-scroll"
              onIcon="pi pi-lock"
              offIcon="pi pi-lock-open"
              class="auto-scroll-toggle"
            />
            <Button
              icon="pi pi-trash"
              label="Clear"
              text
              severity="secondary"
              @click="clearSpans"
            />
          </div>
        </div>
      </template>

      <template #content>
        <!-- Empty State -->
        <div v-if="spans.length === 0" class="empty-state">
          <i class="pi pi-inbox"></i>
          <p>No spans received yet</p>
          <p class="text-small">Waiting for telemetry data...</p>
        </div>

        <!-- Spans List with Virtual Scrolling -->
        <div v-else class="spans-container">
          <VList
            :data="spans"
            :height="600"
            :itemSize="30"
            class="virtua-scroller"
          >
            <template #default="{ item: span, index }">
              <div
                :key="`${span.spanId}-${index}`"
                :class="getSpanRowClass(span)"
              >
                <span class="span-number">{{ index + 1 }}</span>
                <span class="span-content">{{ formatSpanLine(span) }}</span>

                <!-- Show indentation for child spans -->
                <div
                  v-if="span.parentSpanId"
                  class="span-indent"
                  :style="{ width: '20px' }"
                />
              </div>
            </template>
          </VList>
        </div>
      </template>

      <template #footer>
        <div class="card-footer">
          <div class="footer-info">
            <span>Session ID: {{ sessionId }}</span>
            <span class="info-separator">•</span>
            <span>Max window: {{ maxSpans }} spans</span>
            <span
              v-if="connectionStatus === 'connected'"
              class="info-separator"
            >•</span>
            <span v-if="connectionStatus === 'connected'" class="live-indicator">
              <i class="pi pi-circle-fill live-dot"></i>
              LIVE
            </span>
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<style scoped>
@import '@/styles/states.css';

.telemetry-session-view {
  padding: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
}

.view-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
}

.back-button {
  flex-shrink: 0;
}

.header-info {
  flex: 1;
}

.header-info h1 {
  margin: 0 0 0.5rem 0;
  font-size: 1.8rem;
  color: var(--text-color);
}

.session-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-color-secondary);
}

.info-separator {
  color: var(--surface-border);
}

.span-viewer-container {
  background: var(--surface-card);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--surface-border);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.header-left h2 {
  margin: 0;
  font-size: 1.2rem;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.auto-scroll-toggle {
  height: 2rem;
}

.text-small {
  font-size: 0.9rem;
  color: var(--text-color-secondary);
}

.spans-container {
  background: var(--surface-ground);
  border: 1px solid var(--surface-border);
  border-radius: 4px;
  overflow: hidden;
}

.virtua-scroller {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.9rem;
  padding: 0.5rem;
}

.span-row {
  display: flex;
  align-items: center;
  height: 30px;
  padding: 0 0.5rem;
  border-bottom: 1px solid var(--surface-border);
  transition: background-color 0.1s;
}

.span-row:hover {
  background-color: var(--surface-hover);
}

.span-error {
  color: var(--red-500);
}

.span-child {
  padding-left: 2rem;
  font-size: 0.85rem;
  color: var(--text-color-secondary);
}

.span-number {
  width: 60px;
  flex-shrink: 0;
  color: var(--text-color-secondary);
  font-size: 0.8rem;
  text-align: right;
  padding-right: 1rem;
}

.span-content {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.span-indent {
  margin-left: 20px;
}

.card-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--surface-border);
  background: var(--surface-50);
}

.footer-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-color-secondary);
  font-size: 0.9rem;
}

.live-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--green-500);
  font-weight: 600;
}

.live-dot {
  font-size: 0.6rem;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
  100% {
    opacity: 1;
  }
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .view-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .header-right {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>