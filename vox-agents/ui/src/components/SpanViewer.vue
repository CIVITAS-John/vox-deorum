<template>
  <div class="panel-container">
    <Toolbar>
      <template #start>
        <Tag
          :value="`Turn ${rootSpan.turn}`"
          class="mr-2" />
        <Tag
          :value="getStatusText(rootSpan.statusCode)"
          :severity="getStatusSeverity(rootSpan.statusCode)"
          class="mr-2"
        />
        <Tag :value="`${spans.length} spans`" />
      </template>
      <template #end>
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
      </template>
    </Toolbar>

    <div class="spans-content">
      <div v-if="flattenedSpans.length === 0" class="table-empty">
        <i class="pi pi-inbox"></i>
        <p>No spans to display</p>
        <p class="text-small text-muted">Spans will appear here as they are collected</p>
      </div>

      <div v-else class="data-table span-container" ref="spanContainer">
        <!-- Header row -->
        <div class="table-header">
          <div class="col-expand">Name</div>
          <div class="col-fixed-80">Status</div>
          <div class="col-fixed-80">Start Time</div>
          <div class="col-fixed-100">Duration</div>
          <div class="col-fixed-80">Input</div>
          <div class="col-fixed-80">Reasoning</div>
          <div class="col-fixed-80">Output</div>
          <div class="col-fixed-80">Actions</div>
        </div>

        <!-- Span entries using Virtua VList -->
        <VList
          :data="flattenedSpans"
          :style="{ minHeight: scrollerHeight }"
          ref="virtualScroller"
          class="table-body"
          #default="{ item: span, index }"
        >
          <div
            :key="`${span.spanId}-${index}`"
            class="table-row clickable"
            @click="showDetails(span)"
          >
            <div class="col-expand" :style="{ paddingLeft: `${span.depth * 24 + 8}px` }">
              <Button
                v-if="span.children && span.children.length > 0"
                :icon="expandedSpans.has(span.spanId) ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"
                text
                rounded
                size="small"
                style="width: 20px; height: 20px; margin-right: 4px;"
                @click.stop="toggleSpan(span)"
              />
              <span v-else style="display: inline-block; width: 24px;"></span>
              {{ span.name }}
            </div>
            <div class="col-fixed-80">
              <Tag
                :value="getStatusText(span.statusCode)"
                :severity="getStatusSeverity(span.statusCode)"
              />
            </div>
            <div class="col-fixed-80">
              {{ formatTimestamp(span.startTime) }}
            </div>
            <div class="col-fixed-100">
              {{ formatDuration(span.durationMs) }}
            </div>
            <div class="col-fixed-80">
              {{ formatTokenCount(span.attributes?.tokens?.input) }}
            </div>
            <div class="col-fixed-80">
              {{ formatTokenCount(span.attributes?.tokens?.reasoning) }}
            </div>
            <div class="col-fixed-80">
              {{ formatTokenCount(span.attributes?.tokens?.output) }}
            </div>
            <div class="col-fixed-80">
              <Button
                icon="pi pi-info-circle"
                text
                rounded
                size="small"
                @click.stop="showDetails(span)"
              />
            </div>
          </div>
        </VList>
      </div>
    </div>
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
      <div class="detail-row">
        <strong>Span ID:</strong>
        <span>{{ selectedSpan.spanId }}</span>
        <Tag
          :value="getStatusText(selectedSpan.statusCode)"
          :severity="getStatusSeverity(selectedSpan.statusCode)"
        />
      </div>
      <div class="detail-row">
        <strong>Time:</strong>
        <span>{{ formatTimestamp(selectedSpan.startTime) }} ~ {{ formatTimestamp(selectedSpan.endTime) }}</span>
      </div>
      <div class="detail-row">
        <strong>Duration:</strong>
        <span>{{ formatDuration(selectedSpan.durationMs) }}</span>
      </div>
      <div v-if="selectedSpan.statusMessage" class="detail-row">
        <strong>Status Message:</strong>
        <span class="error-message">{{ selectedSpan.statusMessage }}</span>
      </div>

      <!-- Divider line if attributes exist -->
      <hr v-if="selectedSpan.attributes && Object.keys(selectedSpan.attributes).length > 0"
          class="details-divider" />

      <!-- Attributes -->
      <div
        v-for="(value, key) in selectedSpan.attributes"
        :key="key"
        class="detail-row"
      >
        <strong>{{ key }}:</strong>
        <span v-if="typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'">{{ value }}</span>
        <pre v-else class="json-value">{{ JSON.stringify(value, null, 2) }}</pre>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
/**
 * SpanViewer - Component for viewing trace spans in a hierarchical tree structure
 * Similar to LogViewer, displays spans with virtualization and filtering
 */

import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue';
import { VList } from 'virtua/vue';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Tag from 'primevue/tag';
import Toolbar from 'primevue/toolbar';
import Dialog from 'primevue/dialog';
import type { Span } from '../api/types';
import {
  formatDuration,
  formatTimestamp,
  formatTokenCount,
  getStatusSeverity,
  getStatusText,
  buildSpanTree,
  flattenSpanTree,
  type SpanNode
} from '../api/telemetry-utils';
import '/node_modules/primeflex/primeflex.css';

// Props
const props = defineProps<{
  spans: Span[];
  rootSpan: Span;
}>();

// State
const selectedSpan = ref<Span | null>(null);
const showSpanDetails = ref(false);
const expandedSpans = ref<Set<string>>(new Set());
const virtualScroller = ref<any>();
const spanContainer = ref<HTMLElement>();
const scrollerHeight = ref('600px');

// Build span tree using utility
const spanTree = computed(() => buildSpanTree(props.spans));

// Flatten the tree for display using utility
const flattenedSpans = computed(() => flattenSpanTree(spanTree.value, expandedSpans.value));

// Calculate adaptive scroll height
const calculateScrollerHeight = () => {
  // Get viewport height and subtract approximate space for header, controls, padding
  const viewportHeight = window.innerHeight;
  const headerAndControlsHeight = 350; // More space needed due to page header
  const calculatedHeight = Math.max(400, viewportHeight - headerAndControlsHeight);
  scrollerHeight.value = `${calculatedHeight}px`;
};

// Debounce timer
let resizeTimer: ReturnType<typeof setTimeout> | null = null;

// Update dimensions on window resize with debounce
const handleResize = () => {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    calculateScrollerHeight();
  }, 150);
};

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
  // Parse attributes if they're a string
  if (typeof(span.attributes) === "string") {
    span.attributes = JSON.parse(span.attributes);
  }

  // Pre-process all string attributes to parse JSON where possible
  if (span.attributes && typeof span.attributes === 'object') {
    const processed: Record<string, any> = {};
    for (const [key, value] of Object.entries(span.attributes)) {
      if (typeof value === 'string') {
        const parsed = tryParseJSON(value);
        processed[key] = parsed !== null ? parsed : value;
      } else {
        processed[key] = value;
      }
    }
    span.attributes = processed;
  }

  selectedSpan.value = span;
  showSpanDetails.value = true;
}

/**
 * Expand or collapse all spans
 */
function toggleAllSpans(expand: boolean) {
  if (expand) {
    props.spans.forEach(span => {
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
 * Try to parse a string as JSON
 * Returns the parsed object if successful, null otherwise
 */
function tryParseJSON(str: string): any {
  try {
    const parsed = JSON.parse(str);
    // Only return parsed if it's an object or array (not primitive)
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

onMounted(() => {
  calculateScrollerHeight();
  // Auto-expand first level
  if (props.rootSpan) {
    expandedSpans.value.add(props.rootSpan.spanId);
  }
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});
</script>

<style scoped>
@import '@/styles/data-table.css';
@import '@/styles/states.css';
@import '@/styles/panel.css';

.spans-content {
  flex: 1;
  overflow: hidden;
}

.span-details-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.detail-row {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
}

.detail-row strong {
  min-width: 160px;
}

.detail-row span {
  flex: 1;
  word-break: break-word;
  white-space: pre-wrap;
}

.json-value {
  flex: 1;
  margin: 0;
  padding: 0.5rem;
  background: var(--p-content-highlight-color);
  border: 1px solid var(--p-content-border-color);
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.875rem;
  overflow-x: auto;
  white-space: pre;
}

.error-message {
  color: var(--p-red-500);
}

.details-divider {
  border: none;
  border-top: 1px solid var(--p-content-border-color);
  margin: 0.5rem 0;
}
</style>