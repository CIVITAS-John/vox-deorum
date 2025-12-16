<script setup lang="ts">
/**
 * TelemetryTraceView - View all spans for a specific trace with hierarchy
 * Shows detailed span information with parent-child relationships
 */

import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Button from 'primevue/button';
import ProgressSpinner from 'primevue/progressspinner';
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

// Dialog state
const showAgentDialog = ref(false);

// Extract parameters from route
const filename = computed(() => {
  return Array.isArray(route.params.filename)
    ? route.params.filename.join('/')
    : route.params.filename!;
});

const traceId = computed(() => route.params.traceId as string);

/**
 * Go back to database view
 */
function goBack() {
  router.push({
    name: 'telemetry-database',
    params: { filename: route.params.filename }
  });
}

/**
 * Load spans for the trace
 */
async function loadTraceSpans() {
  loading.value = true;
  error.value = null;

  try {
    const response = await api.getTraceSpans(filename.value, traceId.value);
    spans.value = response.spans;

    // Find root span
    rootSpan.value = spans.value.find(s => !s.parentSpanId) || spans.value[0]!;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load trace spans';
    console.error('Error loading trace:', err);
  } finally {
    loading.value = false;
  }
}

/**
 * Open agent dialog
 */
function openAgentDialog() {
  showAgentDialog.value = true;
}

onMounted(() => {
  loadTraceSpans();
});
</script>

<template>
  <div class="telemetry-trace-view">
    <!-- Header with navigation -->
    <div class="page-header">
      <div class="page-header-left">
        <Button
          icon="pi pi-arrow-left"
          text
          rounded
          @click="goBack"
        />
        <h1>{{ rootSpan?.name || 'Trace View' }}</h1>
      </div>
      <div class="page-header-controls">
        <Button
          icon="pi pi-comment"
          @click="openAgentDialog"
          label="Chat with Telepathist"
          severity="primary"
          size="small"
        />
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <ProgressSpinner />
      <p>Loading trace spans...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-container">
      <i class="pi pi-exclamation-triangle"></i>
      <p>{{ error }}</p>
      <Button label="Go Back" @click="goBack" />
    </div>

    <!-- Use SpanViewer component -->
    <SpanViewer
      v-if="rootSpan"
      :spans="spans"
      :root-span="rootSpan"
    />

    <!-- Agent Selection Dialog -->
    <AgentSelectDialog
      v-model:visible="showAgentDialog"
      :databasePath="`telemetry/${filename}`"
      :turn="rootSpan?.attributes?.turn || rootSpan?.turn"
      :span="rootSpan || undefined"
    />
  </div>
</template>

<style scoped>
@import '@/styles/states.css';
</style>