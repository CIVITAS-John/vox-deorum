<script setup lang="ts">
/**
 * TelemetryTraceView - View all spans for a specific trace with hierarchy
 * Shows detailed span information with parent-child relationships
 */

import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Card from 'primevue/card';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import ProgressSpinner from 'primevue/progressspinner';
import Dialog from 'primevue/dialog';
import { api } from '@/api/client';
import type { Span } from '@/api/types';
import {
  formatDuration,
  formatTimestamp,
  getStatusSeverity,
  getStatusText,
  buildSpanTree,
  flattenSpanTree,
  type SpanNode
} from '@/api/telemetry-utils';

const route = useRoute();
const router = useRouter();

// State
const loading = ref(false);
const error = ref<string | null>(null);
const spans = ref<Span[]>([]);
const rootSpan = ref<Span | null>(null);
const selectedSpan = ref<Span | null>(null);
const showSpanDetails = ref(false);
const expandedSpans = ref<Set<string>>(new Set());

// Extract parameters from route
const filename = computed(() => {
  return Array.isArray(route.params.filename)
    ? route.params.filename.join('/')
    : route.params.filename!;
});

const traceId = computed(() => route.params.traceId as string);

// Build span tree using utility
const spanTree = computed(() => buildSpanTree(spans.value));

// Flatten the tree for display using utility
const flattenedSpans = computed(() => flattenSpanTree(spanTree.value, expandedSpans.value));

/**
 * Toggle span expansion
 */
function toggleSpan(span: SpanNode) {
  if (expandedSpans.value.has(span.spanId)) {
    expandedSpans.value.delete(span.spanId);
  } else {
    expandedSpans.value.add(span.spanId);
  }
}

/**
 * Show span details dialog
 */
function showDetails(span: Span) {
  selectedSpan.value = span;
  showSpanDetails.value = true;
}

/**
 * Expand or collapse all spans
 */
function toggleAllSpans(expand: boolean) {
  if (expand) {
    spans.value.forEach(span => {
      // Check if span has children in the tree structure
      const node = spanTree.value.find(n => n.spanId === span.spanId);
      if (node && node.children && node.children.length > 0) {
        expandedSpans.value.add(span.spanId);
      }
    });
  } else {
    expandedSpans.value.clear();
  }
}

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

    // Auto-expand first level
    if (rootSpan.value) {
      expandedSpans.value.add(rootSpan.value.spanId);
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load trace spans';
    console.error('Error loading trace:', err);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadTraceSpans();
});
</script>

<template>
  <div class="telemetry-trace-view">
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
        <h1>Trace {{traceId}}</h1>
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

    <!-- Trace Content -->
    <div v-else class="trace-content">
      <!-- Root Span Summary -->
      <Card v-if="rootSpan" class="root-span-card">
        <template #title>
          <div class="root-span-title">
            <span>{{ rootSpan.name }}</span>
            <Tag
              :value="getStatusText(rootSpan.statusCode)"
              :severity="getStatusSeverity(rootSpan.statusCode)"
            />
          </div>
        </template>
        <template #content>
          <div class="root-span-details">
            <div class="detail-item">
              <strong>Trace ID:</strong>
              <span class="monospace">{{ traceId }}</span>
            </div>
            <div class="detail-item">
              <strong>Start Time:</strong>
              <span>{{ formatTimestamp(rootSpan.startTime) }}</span>
            </div>
            <div class="detail-item">
              <strong>Duration:</strong>
              <span>{{ formatDuration(rootSpan.durationMs) }}</span>
            </div>
            <div class="detail-item">
              <strong>Total Spans:</strong>
              <span>{{ spans.length }}</span>
            </div>
            <div v-if="rootSpan.turn !== null" class="detail-item">
              <strong>Turn:</strong>
              <span>{{ rootSpan.turn }}</span>
            </div>
          </div>
        </template>
      </Card>

      <!-- Span Tree -->
      <Card class="spans-tree-card">
        <template #header>
          <div class="card-header">
            <div class="header-left">
              <h2>Span Hierarchy</h2>
              <Tag :value="`${spans.length} spans`" />
            </div>
            <div class="header-right">
              <Button
                icon="pi pi-plus"
                label="Expand All"
                text
                size="small"
                @click="toggleAllSpans(true)"
              />
              <Button
                icon="pi pi-minus"
                label="Collapse All"
                text
                size="small"
                @click="toggleAllSpans(false)"
              />
            </div>
          </div>
        </template>

        <template #content>
          <div class="spans-tree">
            <div
              v-for="(span, index) in flattenedSpans"
              :key="`${span.spanId}-${index}`"
              class="span-item"
              :style="{ paddingLeft: `${span.depth * 24}px` }"
            >
              <!-- Expand/Collapse Toggle -->
              <Button
                v-if="span.children && span.children.length > 0"
                :icon="expandedSpans.has(span.spanId) ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"
                text
                rounded
                size="small"
                class="expand-button"
                @click="toggleSpan(span)"
              />
              <div v-else class="expand-placeholder"></div>

              <!-- Span Info -->
              <div class="span-info" @click="showDetails(span)">
                <div class="span-main">
                  <span class="span-name">{{ span.name }}</span>
                  <Tag
                    v-if="span.statusCode !== 0"
                    value="ERROR"
                    severity="danger"
                    class="span-status"
                  />
                </div>
                <div class="span-meta">
                  <span class="span-time">{{ formatTimestamp(span.startTime) }}</span>
                  <span class="span-duration">{{ formatDuration(span.durationMs) }}</span>
                  <span v-if="span.attributes?.service_name" class="span-service">
                    {{ span.attributes.service_name }}
                  </span>
                </div>
              </div>

              <!-- View Details Button -->
              <Button
                icon="pi pi-info-circle"
                text
                rounded
                size="small"
                class="details-button"
                @click="showDetails(span)"
              />
            </div>
          </div>
        </template>
      </Card>
    </div>

    <!-- Span Details Dialog -->
    <Dialog
      v-model:visible="showSpanDetails"
      :header="selectedSpan?.name"
      modal
      :style="{ width: '50rem' }"
      :breakpoints="{ '960px': '75vw', '640px': '90vw' }"
    >
      <div v-if="selectedSpan" class="span-details-content">
        <div class="details-section">
          <h3>Basic Information</h3>
          <div class="detail-row">
            <strong>Span ID:</strong>
            <span class="monospace">{{ selectedSpan.spanId }}</span>
          </div>
          <div class="detail-row">
            <strong>Trace ID:</strong>
            <span class="monospace">{{ selectedSpan.traceId }}</span>
          </div>
          <div v-if="selectedSpan.parentSpanId" class="detail-row">
            <strong>Parent Span ID:</strong>
            <span class="monospace">{{ selectedSpan.parentSpanId }}</span>
          </div>
          <div class="detail-row">
            <strong>Start Time:</strong>
            <span>{{ formatTimestamp(selectedSpan.startTime) }}</span>
          </div>
          <div class="detail-row">
            <strong>End Time:</strong>
            <span>{{ formatTimestamp(selectedSpan.endTime) }}</span>
          </div>
          <div class="detail-row">
            <strong>Duration:</strong>
            <span>{{ formatDuration(selectedSpan.durationMs) }}</span>
          </div>
          <div class="detail-row">
            <strong>Status:</strong>
            <Tag
              :value="getStatusText(selectedSpan.statusCode)"
              :severity="getStatusSeverity(selectedSpan.statusCode)"
            />
          </div>
          <div v-if="selectedSpan.statusMessage" class="detail-row">
            <strong>Status Message:</strong>
            <span class="error-message">{{ selectedSpan.statusMessage }}</span>
          </div>
        </div>

        <div v-if="selectedSpan.attributes && Object.keys(selectedSpan.attributes).length > 0"
             class="details-section">
          <h3>Attributes</h3>
          <div class="attributes-list">
            <div
              v-for="(value, key) in selectedSpan.attributes"
              :key="key"
              class="attribute-row"
            >
              <strong>{{ key }}:</strong>
              <span>{{ JSON.stringify(value, null, 2) }}</span>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
@import '@/styles/states.css';

.telemetry-trace-view {
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

.trace-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-color-secondary);
}

.info-separator {
  color: var(--surface-border);
}

.trace-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.root-span-card {
  background: var(--surface-card);
}

.root-span-title {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.root-span-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.detail-item strong {
  color: var(--text-color-secondary);
  font-size: 0.9rem;
}

.detail-item span {
  color: var(--text-color);
}

.monospace {
  font-family: monospace;
  font-size: 0.9rem;
}

.spans-tree-card {
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
  gap: 0.5rem;
}

.spans-tree {
  max-height: 600px;
  overflow-y: auto;
  background: var(--surface-ground);
  border: 1px solid var(--surface-border);
  border-radius: 4px;
}

.span-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-bottom: 1px solid var(--surface-border);
  transition: background-color 0.2s;
}

.span-item:hover {
  background-color: var(--surface-hover);
}

.expand-button {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.expand-placeholder {
  width: 24px;
  flex-shrink: 0;
}

.span-info {
  flex: 1;
  cursor: pointer;
}

.span-main {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.span-name {
  font-weight: 500;
  color: var(--text-color);
}

.span-status {
  font-size: 0.75rem;
}

.span-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.85rem;
  color: var(--text-color-secondary);
}

.span-time {
  font-family: monospace;
}

.span-duration {
  color: var(--primary-color);
}

.span-service {
  font-style: italic;
}

.details-button {
  flex-shrink: 0;
}

.span-details-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.details-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.details-section h3 {
  margin: 0;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--surface-border);
  color: var(--text-color);
  font-size: 1rem;
}

.detail-row {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.detail-row strong {
  min-width: 150px;
  color: var(--text-color-secondary);
}

.detail-row span {
  flex: 1;
  color: var(--text-color);
  word-break: break-all;
}

.error-message {
  color: var(--red-500);
}

.attributes-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.attribute-row {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  padding: 0.5rem;
  background: var(--surface-50);
  border-radius: 4px;
}

.attribute-row strong {
  min-width: 150px;
  color: var(--text-color-secondary);
  font-weight: 500;
}

.attribute-row span {
  flex: 1;
  color: var(--text-color);
  font-family: monospace;
  font-size: 0.9rem;
  white-space: pre-wrap;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .view-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .root-span-details {
    grid-template-columns: 1fr;
  }

  .card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .detail-row,
  .attribute-row {
    flex-direction: column;
    gap: 0.25rem;
  }
}
</style>