import { ref } from 'vue';
import { api } from '../api/client';
import type { TelemetryMetadata } from '@/api/types';

/**
 * Store for telemetry data with auto-refresh functionality
 */

export const activeSessions = ref<string[]>([]);
export const databases = ref<TelemetryMetadata[]>([]);
export const loading = ref(false);

/**
 * Fetch active telemetry sessions
 */
const fetchSessions = async () => {
  try {
    const response = await api.getTelemetrySessions();
    activeSessions.value = response.sessions || [];
  } catch (error) {
    console.error('Failed to fetch telemetry sessions:', error);
  }
};

/**
 * Fetch telemetry databases
 */
const fetchDatabases = async () => {
  try {
    const response = await api.getTelemetryDatabases();
    databases.value = response.databases || [];
  } catch (error) {
    console.error('Failed to fetch telemetry databases:', error);
  }
};

/**
 * Fetch all telemetry data
 */
export const fetchTelemetryData = async () => {
  loading.value = true;
  try {
    await Promise.all([fetchSessions(), fetchDatabases()]);
  } finally {
    loading.value = false;
  }
};

// Start fetching sessions immediately and every 5 seconds (similar to health.ts)
fetchSessions();
setInterval(fetchSessions, 5000);

// Fetch databases on initialization
fetchDatabases();