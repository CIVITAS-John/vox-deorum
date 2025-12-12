<script setup lang="ts">
/**
 * TelemetryDatabaseView - Display traces from a telemetry database file
 * Shows a list of root spans (traces) with search and navigation capabilities
 */

import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Card from 'primevue/card';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Tag from 'primevue/tag';
import ProgressSpinner from 'primevue/progressspinner';
import { api } from '@/api/client';
import type { Span } from '@/api/types';
import {
  formatDuration,
  formatTimestamp,
  getStatusSeverity,
  getStatusText,
  getDisplayAttributes
} from '@/api/telemetry-utils';

const route = useRoute();
const router = useRouter();

// State
const loading = ref(false);
const error = ref<string | null>(null);
const traces = ref<Span[]>([]);
const searchQuery = ref('');
const pageSize = 20;
const currentPage = ref(0);

// Extract filename from route params
const filename = computed(() => {
  // The filename param can include folder path (e.g., "uploaded/game123.db")
  return Array.isArray(route.params.filename)
    ? route.params.filename.join('/')
    : route.params.filename!;
});

/**
 * Frontend search filtering
 */
const filteredTraces = computed(() => {
  if (!searchQuery.value.trim()) {
    return traces.value;
  }

  const query = searchQuery.value.toLowerCase();
  return traces.value.filter(trace => {
    // Search in name, service name, and attributes
    if (trace.name.toLowerCase().includes(query)) return true;
    if (trace.attributes?.service_name?.toLowerCase()?.includes(query)) return true;

    // Search in stringified attributes
    const attrStr = JSON.stringify(trace.attributes).toLowerCase();
    return attrStr.includes(query);
  });
});

/**
 * Paginated traces for display
 */
const paginatedTraces = computed(() => {
  const start = currentPage.value * pageSize;
  const end = start + pageSize;
  return filteredTraces.value.slice(start, end);
});

/**
 * Total pages calculation
 */
const totalPages = computed(() => {
  return Math.ceil(filteredTraces.value.length / pageSize);
});

/**
 * Navigate to trace detail view
 */
function viewTrace(trace: Span) {
  router.push({
    name: 'telemetry-trace',
    params: {
      filename: route.params.filename,
      traceId: trace.traceId
    }
  });
}

/**
 * Go back to telemetry main view
 */
function goBack() {
  router.push({ name: 'telemetry' });
}

/**
 * Load traces from the database
 */
async function loadTraces() {
  loading.value = true;
  error.value = null;

  try {
    // Load all traces (root spans) from the database
    // Using a high limit to get all traces for frontend filtering
    const response = await api.getDatabaseTraces(filename.value, 1000, 0);
    traces.value = response.traces;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load traces';
    console.error('Error loading traces:', err);
  } finally {
    loading.value = false;
  }
}

// Reset page when search changes
watch(searchQuery, () => {
  currentPage.value = 0;
});

onMounted(() => {
  loadTraces();
});
</script>

<template>
  <div class="telemetry-database-view">
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
        <h1>Traces in {{ filename }}</h1>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <ProgressSpinner />
      <p>Loading traces...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-container">
      <i class="pi pi-exclamation-triangle"></i>
      <p>{{ error }}</p>
      <Button label="Retry" @click="loadTraces" />
    </div>

    <!-- Traces List -->
    <Card v-else class="traces-container">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <h2>Traces</h2>
            <Tag :value="`${filteredTraces.length} traces`" />
          </div>
          <div class="header-right">
            <span class="p-input-icon-left search-box">
              <i class="pi pi-search" />
              <InputText
                v-model="searchQuery"
                placeholder="Search traces..."
                class="search-input"
              />
            </span>
          </div>
        </div>
      </template>

      <template #content>
        <!-- Empty State -->
        <div v-if="traces.length === 0" class="empty-state">
          <i class="pi pi-inbox"></i>
          <p>No traces found in this database</p>
        </div>

        <!-- No Search Results -->
        <div v-else-if="filteredTraces.length === 0" class="empty-state">
          <i class="pi pi-search"></i>
          <p>No traces match your search</p>
          <Button
            label="Clear Search"
            text
            @click="searchQuery = ''"
          />
        </div>

        <!-- Traces Grid -->
        <div v-else class="traces-grid">
          <div
            v-for="trace in paginatedTraces"
            :key="trace.spanId"
            class="trace-card"
            @click="viewTrace(trace)"
          >
            <div class="trace-header">
              <div class="trace-name">{{ trace.name }}</div>
              <Tag
                :value="getStatusText(trace.statusCode)"
                :severity="getStatusSeverity(trace.statusCode)"
                class="status-tag"
              />
            </div>

            <div class="trace-details">
              <div class="trace-timing">
                <i class="pi pi-clock"></i>
                <span>{{ formatTimestamp(trace.startTime) }}</span>
                <span class="separator">•</span>
                <span>{{ formatDuration(trace.durationMs) }}</span>
              </div>

              <div class="trace-attributes">
                <span
                  v-for="attr in getDisplayAttributes(trace)"
                  :key="attr.key"
                  class="attribute-item"
                >
                  <strong>{{ attr.key }}:</strong> {{ attr.value }}
                </span>
              </div>
            </div>

            <div class="trace-footer">
              <span class="trace-id">{{ trace.traceId.substring(0, 8) }}...</span>
              <Button
                icon="pi pi-chart-line"
                label="View Details"
                text
                size="small"
                @click.stop="viewTrace(trace)"
              />
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="pagination">
          <Button
            icon="pi pi-angle-double-left"
            :disabled="currentPage === 0"
            @click="currentPage = 0"
            text
            rounded
          />
          <Button
            icon="pi pi-angle-left"
            :disabled="currentPage === 0"
            @click="currentPage--"
            text
            rounded
          />
          <span class="page-info">
            Page {{ currentPage + 1 }} of {{ totalPages }}
          </span>
          <Button
            icon="pi pi-angle-right"
            :disabled="currentPage === totalPages - 1"
            @click="currentPage++"
            text
            rounded
          />
          <Button
            icon="pi pi-angle-double-right"
            :disabled="currentPage === totalPages - 1"
            @click="currentPage = totalPages - 1"
            text
            rounded
          />
        </div>
      </template>
    </Card>
  </div>
</template>

<style scoped>
@import '@/styles/states.css';

.telemetry-database-view {
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

.database-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-color-secondary);
}

.info-separator {
  color: var(--surface-border);
}

.traces-container {
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

.search-box {
  width: 300px;
}

.search-input {
  width: 100%;
}

.traces-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 1rem;
  padding: 1rem;
}

.trace-card {
  background: var(--surface-ground);
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.trace-card:hover {
  border-color: var(--primary-color);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}

.trace-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

.trace-name {
  font-weight: 600;
  color: var(--text-color);
  font-size: 1rem;
  flex: 1;
  margin-right: 0.5rem;
  word-break: break-word;
}

.status-tag {
  flex-shrink: 0;
}

.trace-details {
  margin-bottom: 0.75rem;
}

.trace-timing {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-color-secondary);
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}

.trace-timing i {
  font-size: 0.85rem;
}

.separator {
  color: var(--surface-border);
}

.trace-attributes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.attribute-item {
  font-size: 0.85rem;
  color: var(--text-color-secondary);
  padding: 0.25rem 0.5rem;
  background: var(--surface-50);
  border-radius: 4px;
}

.attribute-item strong {
  color: var(--text-color);
  font-weight: 500;
}

.trace-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.75rem;
  border-top: 1px solid var(--surface-border);
}

.trace-id {
  font-family: monospace;
  font-size: 0.8rem;
  color: var(--text-color-secondary);
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  border-top: 1px solid var(--surface-border);
}

.page-info {
  padding: 0 1rem;
  color: var(--text-color-secondary);
  font-size: 0.9rem;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .traces-grid {
    grid-template-columns: 1fr;
  }

  .search-box {
    width: 200px;
  }

  .view-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>