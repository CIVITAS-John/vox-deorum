<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import Card from 'primevue/card';
import Button from 'primevue/button';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';
import ChatSessionsList from '@/components/ChatSessionsList.vue';
import GameSessionsList from '@/components/GameSessionsList.vue';
import AgentSelectDialog from '@/components/AgentSelectDialog.vue';
import DeleteSessionDialog from '@/components/DeleteSessionDialog.vue';
import { activeSessions, chatSessions, loading, loadingChats, fetchTelemetryData, fetchChatData } from '@/stores/telemetry';
import type { EnvoyThread } from '@/utils/types';

/**
 * Chat view component - entry point for agent chat interactions
 */

const router = useRouter();

// Dialog state
const showAgentDialog = ref(false);
const showDeleteDialog = ref(false);
const selectedContextId = ref<string | undefined>();
const sessionToDelete = ref<EnvoyThread | null>(null);

/**
 * Check if any sessions are available
 */
const hasActiveSessions = computed(() => activeSessions.value.length > 0);
const hasChatSessions = computed(() => chatSessions.value.length > 0);
const hasAnySessions = computed(() => hasActiveSessions.value || hasChatSessions.value);

/**
 * Handle game session selection for starting new chat
 */
function handleGameSessionSelected(sessionId: string) {
  // Show agent selection dialog with the selected session context
  selectedContextId.value = sessionId;
  showAgentDialog.value = true;
}

/**
 * Handle chat session selection for viewing details
 */
function handleChatSessionSelected(session: EnvoyThread) {
  // Navigate to chat detail view
  router.push({ name: 'chat-detail', params: { sessionId: session.id } });
}

/**
 * Resume an existing chat session
 */
function handleChatResume(sessionId: string) {
  router.push({ name: 'chat-detail', params: { sessionId } });
}

/**
 * Delete a chat session
 */
function handleChatDelete(sessionId: string) {
  const session = chatSessions.value.find(s => s.id === sessionId);
  if (session) {
    sessionToDelete.value = session;
    showDeleteDialog.value = true;
  }
}

/**
 * Handle successful deletion
 */
function handleDeleteSuccess() {
  // Refresh the chat list
  fetchChatData();
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
fetchChatData();
</script>

<template>
  <div class="chat-view">
    <h1>Chat with Agents</h1>

    <div v-if="loading || loadingChats" class="loading-container">
      <ProgressSpinner />
      <p>Loading sessions...</p>
    </div>

    <!-- Active Chat Sessions (only show if there are any) -->
    <ChatSessionsList
      v-if="hasChatSessions"
      :sessions="chatSessions"
      title="Active Chat Sessions"
      emptyMessage="No active chat sessions."
      :show-actions="true"
      @session-selected="handleChatSessionSelected"
      @session-resume="handleChatResume"
      @session-delete="handleChatDelete"
      class="section-margin"
    />

    <!-- Active Game Sessions -->
    <GameSessionsList
      :sessions="activeSessions"
      title="Choose a Game Session to Start Chat"
      emptyMessage="No active game sessions available."
      :show-view-button="false"
      @session-selected="handleGameSessionSelected"
      class="section-margin">
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
    </GameSessionsList>

    <!-- Info message for historical sessions when active games exist -->
    <Message v-if="hasActiveSessions" severity="info" :closable="false">
      Looking for past games? Visit the <a @click="goToTelemetryView" class="telemetry-link">Telemetry page</a> to browse historical sessions.
    </Message>

    <!-- Agent Selection Dialog -->
    <AgentSelectDialog
      v-model:visible="showAgentDialog"
      :contextId="selectedContextId"
    />

    <!-- Delete Confirmation Dialog -->
    <DeleteSessionDialog
      v-model="showDeleteDialog"
      :session="sessionToDelete"
      @deleted="handleDeleteSuccess"
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

.section-margin {
  margin-bottom: 1.5rem;
}
</style>