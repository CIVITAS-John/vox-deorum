<script setup lang="ts">
/**
 * TelemetrySessionView - View spans from a telemetry session
 * Shows session spans with simple display
 */

import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Button from 'primevue/button';
import ProgressSpinner from 'primevue/progressspinner';
import SpanViewer from '@/components/SpanViewer.vue';
import { api } from '@/api/client';
import type { Span } from '@/api/types';

const route = useRoute();
const router = useRouter();

// State
const loading = ref(false);
const error = ref<string | null>(null);
const spans = ref<Span[]>([]);
const rootSpan = ref<Span | null>(null);

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

    // Find root span or use first span
    rootSpan.value = spans.value.find(s => !s.parentSpanId) || spans.value[0] || null;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load session spans';
    console.error('Error loading session:', err);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadSessionSpans();
});
</script>

<template>
  <div class="telemetry-session-view">
    <!-- Header with navigation -->
    <div class="simple-header">
      <Button
        icon="pi pi-arrow-left"
        text
        rounded
        @click="goBack"
      />
      <h1>Session {{ sessionId }}</h1>
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

    <!-- Empty State -->
    <div v-else-if="spans.length === 0" class="empty-container">
      <i class="pi pi-inbox"></i>
      <p>No spans found for this session</p>
      <Button label="Go Back" @click="goBack" />
    </div>

    <!-- Use SpanViewer component -->
    <SpanViewer
      v-else-if="rootSpan"
      :spans="spans"
      :root-span="rootSpan"
    />
  </div>
</template>

<style scoped>
@import '@/styles/states.css';
</style>