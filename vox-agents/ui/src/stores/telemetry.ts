import { ref } from 'vue';
import { api } from '../api/client';
import type { TelemetryMetadata, TelemetrySession, EnvoyThread } from '@/utils/types';

/**
 * Store for telemetry data with auto-refresh functionality
 */

export const activeSessions = ref<TelemetrySession[]>([]);
export const chatSessions = ref<EnvoyThread[]>([]);
export const databases = ref<TelemetryMetadata[]>([]);
export const loading = ref(false);
export const loadingChats = ref(false);

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
 * Fetch telemetry databases and sort by last modified date (descending)
 */
const fetchDatabases = async () => {
  try {
    const response = await api.getTelemetryDatabases();
    // Sort databases by lastModified in descending order (newest first)
    databases.value = (response.databases || []).sort((a, b) => {
      const dateA = new Date(a.lastModified).getTime();
      const dateB = new Date(b.lastModified).getTime();
      return dateB - dateA; // Descending order
    });
  } catch (error) {
    console.error('Failed to fetch telemetry databases:', error);
  }
};

/**
 * Fetch active chat threads
 */
const fetchChatSessions = async () => {
  try {
    const response = await api.getAgentChats();
    chatSessions.value = response.chats || [];
  } catch (error) {
    console.error('Failed to fetch chat threads:', error);
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

/**
 * Fetch chat sessions
 */
export const fetchChatData = async () => {
  loadingChats.value = true;
  try {
    await fetchChatSessions();
  } finally {
    loadingChats.value = false;
  }
};

// Start fetching sessions immediately and every 5 seconds (similar to health.ts)
fetchSessions();
setInterval(fetchSessions, 5000);

// Start fetching chat sessions periodically
fetchChatSessions();
setInterval(fetchChatSessions, 5000);

// Fetch databases on initialization
fetchDatabases();