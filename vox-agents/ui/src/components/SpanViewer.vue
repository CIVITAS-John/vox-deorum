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
        <Tag :value="`${spans.length} spans`" class="mr-2" />
      </template>
      <template #end>
        <Button
          :icon="autoscroll ? 'pi pi-lock' : 'pi pi-lock-open'"
          @click="autoscroll = !autoscroll"
          label="Auto-scroll"
          severity="secondary"
          size="small"
          class="mr-2"
          v-if="isStreaming"
        />
        <Button
          icon="pi pi-plus"
          label="Expand All"
          text
          size="small"
          @click="toggleAllSpans(true)"
          class="mr-2"
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
              {{ formatTokenCount(span.attributes?.['tokens.input']) }}
            </div>
            <div class="col-fixed-80">
              {{ formatTokenCount(span.attributes?.['tokens.reasoning']) }}
            </div>
            <div class="col-fixed-80">
              {{ formatTokenCount(span.attributes?.['tokens.output']) }}
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
    :style="{ width: '80rem' }"
    :breakpoints="{ '1400px': '90vw', '960px': '95vw', '640px': '100vw' }"
    :closeOnEscape="true"
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
        <!-- Use AIMessagesViewer for AI message-like data -->
        <div v-else-if="isAIMessageData(value)" class="ai-messages-container">
          <AIMessagesViewer :messages="value" />
        </div>
        <div v-else class="json-container">
          <VueJsonPretty
            :data="value"
            :show-icon="true"
            :show-line-number="false"
            :deep="3"
            :collapsed-on-click-brackets="true"
            :show-double-quotes="true"
            :virtual="false"
            :highlight-selected-node="false"
            class="json-pretty"
          />
        </div>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
/**
 * SpanViewer - Component for viewing trace spans in a hierarchical tree structure
 * Similar to LogViewer, displays spans with virtualization, filtering, and streaming support
 */

import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue';
import { VList } from 'virtua/vue';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Tag from 'primevue/tag';
import Toolbar from 'primevue/toolbar';
import Dialog from 'primevue/dialog';
import VueJsonPretty from 'vue-json-pretty';
import 'vue-json-pretty/lib/styles.css';
import AIMessagesViewer from './AIMessagesViewer.vue';
import type { Span } from '../utils/types';
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
  isStreaming?: boolean;
}>();

// State
const selectedSpan = ref<Span | null>(null);
const showSpanDetails = ref(false);
const expandedSpans = ref<Set<string>>(new Set());
const virtualScroller = ref<any>();
const spanContainer = ref<HTMLElement>();
const scrollerHeight = ref('600px');
const autoscroll = ref(true); // Local autoscroll state, default to true

// Parse attributes for all spans upfront
const parsedSpans = computed(() => {
  return props.spans.map(span => {
    if (typeof span.attributes === 'string') {
      try {
        span.attributes = JSON.parse(span.attributes);
      } catch {
        // Keep as string if parsing fails
      }
    }
    return span;
  });
});

// Build span tree using utility
const spanTree = computed(() => buildSpanTree(parsedSpans.value));

// Flatten the tree for display using utility
const flattenedSpans = computed(() => flattenSpanTree(spanTree.value, expandedSpans.value));

// Watch for new spans to handle autoscroll when streaming
watch(() => props.spans, (newSpans, oldSpans) => {
  // Auto-expand all when streaming
  if (props.isStreaming && newSpans.length > (oldSpans?.length ?? 0)) {
    toggleAllSpans(true);
  }

  // Only autoscroll if streaming and enabled
  if (props.isStreaming && autoscroll.value && virtualScroller.value && newSpans.length > (oldSpans?.length ?? 0)) {
    nextTick(() => {
      const targetIndex = flattenedSpans.value.length - 1;
      if (targetIndex >= 0) {
        requestAnimationFrame(() => {
          virtualScroller.value.scrollToIndex(targetIndex, { align: 'end' });
        });
      }
    });
  }
});

// Watch for initial load and when autoscroll is enabled
watch([autoscroll, () => flattenedSpans.value], ([autoScroll, spans]) => {
  if (autoScroll && spans.length > 0 && virtualScroller.value) {
    nextTick(() => {
      const targetIndex = spans.length - 1;
      requestAnimationFrame(() => {
        virtualScroller.value.scrollToIndex(targetIndex, { align: 'end' });
      });
    });
  }
}, { immediate: true });

// Calculate adaptive scroll height
const calculateScrollerHeight = () => {
  // Get viewport height and subtract approximate space for header, controls, padding
  const viewportHeight = window.innerHeight;
  const headerAndControlsHeight = 250; // More space needed due to page header
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
    selectedSpan.value = { ...span, attributes: processed };
  } else {
    selectedSpan.value = span;
  }
  showSpanDetails.value = true;
}

/**
 * Expand or collapse all spans recursively
 */
function toggleAllSpans(expand: boolean) {
  if (expand) {
    // Recursively add all parent spans to expanded set
    const addAllParents = (nodes: SpanNode[]) => {
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          expandedSpans.value.add(node.spanId);
          addAllParents(node.children);
        }
      });
    };
    addAllParents(spanTree.value);
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

/**
 * Check if the value contains AI message data
 */
function isAIMessageData(value: any): boolean {
  return Array.isArray(value) && value.length > 0 && value[0]?.role !== undefined;
}

onMounted(() => {
  calculateScrollerHeight();
  // Auto-expand all spans by default
  toggleAllSpans(true);

  // Initial scroll to end if autoscroll is enabled
  if (autoscroll.value && flattenedSpans.value.length > 0) {
    nextTick(() => {
      if (virtualScroller.value) {
        const targetIndex = flattenedSpans.value.length - 1;
        requestAnimationFrame(() => {
          virtualScroller.value.scrollToIndex(targetIndex, { align: 'end' });
        });
      }
    });
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

.json-container {
  flex: 1;
  padding: 0.5rem;
  background: var(--p-content-hover-background);
  border: 1px solid var(--p-content-border-color);
  border-radius: 4px;
  overflow-x: auto;
}

.ai-messages-container {
  flex: 1;
  max-height: 600px;
  overflow-y: auto;
  border: 1px solid var(--p-content-border-color);
  border-radius: 4px;
}

.json-pretty {
  font-family: monospace;
  font-size: 0.875rem;
}

/* Override vue-json-pretty default colors for better integration with PrimeVue themes */
:deep(.vjs-tree) {
  color: var(--p-text-color) !important;
}

:deep(.vjs-key) {
  color: var(--p-primary-color) !important;
}

:deep(.vjs-value__string) {
  color: var(--p-green-500) !important;
}

:deep(.vjs-value__number) {
  color: var(--p-blue-500) !important;
}

:deep(.vjs-value__boolean) {
  color: var(--p-orange-500) !important;
}

:deep(.vjs-value__null) {
  color: var(--p-gray-500) !important;
}

:deep(.vjs-tree__brackets) {
  color: var(--p-text-muted-color) !important;
}

.error-message {
  color: var(--p-red-500);
}

.details-divider {
  border: none;
  border-top: 1px solid var(--p-content-border-color);
  margin: 0.5rem 0;
}

.autoscroll-indicator {
  display: inline-flex;
  align-items: center;
  color: var(--p-primary-500);
  font-size: 0.875rem;
  padding: 0.25rem 0.5rem;
  background: var(--p-primary-50);
  border-radius: 4px;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}
</style>