<script setup lang="ts">
/**
 * TelemetrySessionView - View spans from a telemetry session
 * Shows session spans with support for streaming and auto-scrolling
 */

import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Button from 'primevue/button';
import ProgressSpinner from 'primevue/progressspinner';
import Tag from 'primevue/tag';
import SpanViewer from '@/components/SpanViewer.vue';
import AgentSelectDialog from '@/components/AgentSelectDialog.vue';
import { api } from '@/api/client';
import type { Span } from '../utils/types';

const route = useRoute();
const router = useRouter();

// State
const loading = ref(false);
const error = ref<string | null>(null);
const spans = ref<Span[]>([]);
const rootSpan = ref<Span | null>(null);
const isStreaming = ref(false);
const streamCleanup = ref<(() => void) | null>(null);

// Dialog state
const showAgentDialog = ref(false);

// Extract session ID from route
const sessionId = computed(() => route.params.sessionId as string);

/**
 * Go back to telemetry main view
 */
function goBack() {
  router.push({ name: 'telemetry' });
}

/**
 * Load spans for the session
 */
async function loadSessionSpans() {
  loading.value = true;
  error.value = null;

  try {
    const response = await api.getSessionSpans(sessionId.value);
    spans.value = response.spans;

    // Use the last span to show correct turn number/status code
    rootSpan.value = spans.value[spans.value.length - 1]!;

    // Start streaming if the session is still active
    startStreaming();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load session spans';
    console.error('Error loading session:', err);
  } finally {
    loading.value = false;
  }
}

/**
 * Start streaming new spans via SSE
 */
function startStreaming() {
  if (streamCleanup.value) return;

  isStreaming.value = true;

  // Connect to SSE stream for this session
  streamCleanup.value = api.streamSessionSpans(
    sessionId.value,
    (allSpans: Span[]) => {
      // Add new spans to the list
      for (const span of allSpans) {
        // Check if span already exists
        const existingIndex = spans.value.findIndex(s => s.spanId === span.spanId);
        if (existingIndex >= 0) {
          // Update existing span
          spans.value[existingIndex] = span;
        } else {
          // Add new span
          spans.value.push(span);
        }
      }

      // Sort spans by start time
      spans.value.sort((a, b) => a.startTime - b.startTime);

      // Use the last span to show correct turn number/status code
      rootSpan.value = spans.value[spans.value.length - 1]!;
    },
    (error: Event) => {
      console.error('Stream error:', error);
      stopStreaming();
    }
  );
}

/**
 * Stop streaming spans
 */
function stopStreaming() {
  if (streamCleanup.value) {
    streamCleanup.value();
    streamCleanup.value = null;
  }
  isStreaming.value = false;
}

/**
 * Toggle streaming mode manually
 */
function toggleStreaming() {
  if (isStreaming.value) {
    stopStreaming();
  } else {
    startStreaming();
  }
}

/**
 * Open agent selection dialog
 */
function openAgentDialog() {
  showAgentDialog.value = true;
}

onMounted(() => {
  loadSessionSpans();
});

onUnmounted(() => {
  stopStreaming();
});
</script>

<template>
  <div class="telemetry-session-view">
    <!-- Header with navigation and controls -->
    <div class="page-header">
      <div class="page-header-left">
        <Button
          icon="pi pi-arrow-left"
          text
          rounded
          @click="goBack"
        />
        <h1>Session {{ sessionId }}</h1>
        <Tag v-if="isStreaming" severity="info" class="streaming-tag">
          <i class="pi pi-spin pi-spinner mr-1"></i>
          Streaming
        </Tag>
      </div>
      <div class="page-header-controls">
        <Button
          icon="pi pi-comment"
          @click="openAgentDialog"
          label="Chat"
          severity="primary"
          size="small"
          class="mr-1"
        />
        <Button
          :icon="isStreaming ? 'pi pi-pause' : 'pi pi-play'"
          @click="toggleStreaming"
          :label="isStreaming ? 'Pause' : 'Resume'"
          severity="secondary"
          size="small"
          class="mr-1"
        />
        <Button
          icon="pi pi-refresh"
          @click="loadSessionSpans"
          label="Refresh"
          severity="secondary"
          size="small"
          :loading="loading"
        />
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading && !spans.length" class="loading-container">
      <ProgressSpinner />
      <p>Loading session spans...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-container">
      <i class="pi pi-exclamation-triangle"></i>
      <p>{{ error }}</p>
      <Button label="Go Back" @click="goBack" />
    </div>

    <!-- Empty State -->
    <div v-else-if="spans.length === 0" class="empty-container">
      <i class="pi pi-inbox"></i>
      <p>No spans found for this session</p>
      <Button label="Go Back" @click="goBack" />
    </div>

    <!-- Use SpanViewer component with streaming props -->
    <SpanViewer
      v-else-if="rootSpan"
      :spans="spans"
      :root-span="rootSpan"
      :is-streaming="isStreaming"
    />

    <!-- Agent Selection Dialog -->
    <AgentSelectDialog
      v-model:visible="showAgentDialog"
      :contextId="sessionId"
    />
  </div>
</template>

<style scoped>
@import '@/styles/states.css';

.streaming-tag {
  animation: pulse 2s infinite;
}
</style>