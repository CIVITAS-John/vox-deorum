<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import Card from 'primevue/card';
import Button from 'primevue/button';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';
import ActiveSessionsList from '@/components/ActiveSessionsList.vue';
import AgentSelectDialog from '@/components/AgentSelectDialog.vue';
import { activeSessions, loading, fetchTelemetryData } from '@/stores/telemetry';

/**
 * Chat view component - entry point for agent chat interactions
 */

const router = useRouter();

// Dialog state
const showAgentDialog = ref(false);
const selectedContextId = ref<string | undefined>();

/**
 * Check if any sessions are available
 */
const hasActiveSessions = computed(() => activeSessions.value.length > 0);

/**
 * Handle session selection for chat
 */
function handleSessionSelected(sessionId: string) {
  // Show agent selection dialog with the selected session context
  selectedContextId.value = sessionId;
  showAgentDialog.value = true;
}

/**
 * Navigate to session view to start new games
 */
function goToSessionView() {
  router.push({ name: 'session' });
}

/**
 * Navigate to telemetry view to find historical sessions
 */
function goToTelemetryView() {
  router.push({ name: 'telemetry' });
}

// Fetch sessions on mount
fetchTelemetryData();
</script>

<template>
  <div class="chat-view">
    <h1>Chat with Agents</h1>

    <div v-if="loading" class="loading-container">
      <ProgressSpinner />
      <p>Loading sessions...</p>
    </div>

    <!-- Active Sessions List -->
    <ActiveSessionsList
      :sessions="activeSessions"
      title="Choose an Active Game Session"
      emptyMessage="No active sessions available."
      :show-view-button="false"
      @session-selected="handleSessionSelected">
      <template #empty-action>
        <div class="empty-action-container">
          <Button
            label="Start Game"
            icon="pi pi-play"
            @click="goToSessionView"
            severity="primary" />
          <Button
            label="Browse Archives"
            icon="pi pi-history"
            @click="goToTelemetryView"
            severity="secondary" />
        </div>
      </template>
    </ActiveSessionsList>

    <!-- Info message for historical sessions when active games exist -->
    <Message v-if="hasActiveSessions" severity="info" :closable="false">
      Looking for past games? Visit the <a @click="goToTelemetryView" class="telemetry-link">Telemetry page</a> to browse historical sessions.
    </Message>

    <!-- Agent Selection Dialog -->
    <AgentSelectDialog
      v-model:visible="showAgentDialog"
      :contextId="selectedContextId"
    />
  </div>
</template>

<style scoped>
@import '@/styles/global.css';
@import '@/styles/states.css';

.empty-action-container {
  display: flex;
  gap: 1rem;
  text-align: center;
  margin-top: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.telemetry-link {
  color: var(--primary-color);
  cursor: pointer;
  text-decoration: underline;
}

.telemetry-link:hover {
  opacity: 0.8;
}

.active-sessions-card {
  margin-bottom: 1rem;
}
</style>