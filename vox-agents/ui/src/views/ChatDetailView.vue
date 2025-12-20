<!--
View: ChatDetailView
Purpose: Main chat interface for interacting with agents
-->
<template>
  <div class="chat-detail-container">
    <!-- Header -->
    <div class="page-header">
      <div class="page-header-left">
        <Button
          icon="pi pi-arrow-left"
          text
          rounded
          @click="goBack"
        />
        <h1>{{ thread?.title || `${thread?.agent || 'Loading'} Chat` }}</h1>
        <div v-if="thread" class="flex align-items-center gap-2" style="margin-left: 1rem">
          <Tag :value="thread.contextType" :severity="thread.contextType === 'live' ? 'success' : 'info'" />
          <span class="text-sm text-muted">Game: {{ thread.gameID }} | Player: {{ thread.playerID }}</span>
        </div>
      </div>
      <div class="page-header-controls">
        <Button
          label="Delete"
          icon="pi pi-trash"
          text
          severity="danger"
          @click="confirmDelete"
          v-if="thread"
        />
      </div>
    </div>

    <!-- Messages Container -->
    <div class="messages-wrapper">
      <ChatMessages
        v-if="thread"
        :messages="thread.messages"
        :scroll-trigger="newChunkEvent"
      />
      <div v-else class="loading-container">
        <ProgressSpinner />
        <p>Loading chat session...</p>
      </div>
    </div>

    <!-- Input Area -->
    <div class="input-area">
      <Textarea
        v-model="inputMessage"
        :disabled="isStreaming || !thread"
        @keydown.enter.prevent="handleEnterKey"
        placeholder="Type your message..."
        :rows="3"
        auto-resize
        class="input-textarea"
      />
      <Button
        @click="sendMessage"
        :disabled="!inputMessage.trim() || isStreaming || !thread"
        :loading="isStreaming"
        icon="pi pi-send"
        label="Send"
      />
    </div>

    <!-- Delete confirmation dialog -->
    <DeleteSessionDialog
      v-model="showDeleteDialog"
      :session="thread"
      :redirect-after-delete="true"
      redirect-path="/chat"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';
import ProgressSpinner from 'primevue/progressspinner';
import { useToast } from 'primevue/usetoast';
import { api } from '../api/client';
import type { EnvoyThread, ChatMessageRequest } from '../utils/types';
import type { ModelMessage } from 'ai';
import ChatMessages from '../components/chat/ChatMessages.vue';
import DeleteSessionDialog from '../components/DeleteSessionDialog.vue';
import { useThreadMessages } from '../composables/useThreadMessages';

const route = useRoute();
const router = useRouter();
const toast = useToast();

// State
const thread = ref<EnvoyThread | null>(null);
const inputMessage = ref('');
const isStreaming = ref(false);
const showDeleteDialog = ref(false);
let sseCleanup: (() => void) | null = null;

// Event emitter for new chunks
const newChunkEvent = ref(0);

// Computed
const sessionId = computed(() => route.params.sessionId as string);

// Use the thread messages composable
const { sendMessage: sendThreadMessage } = useThreadMessages({
  thread,
  sessionId,
  isStreaming,
  onNewChunk: () => {
    // Increment the event counter to trigger a reactive update
    newChunkEvent.value++;
  }
});

// Methods
const goBack = () => {
  router.push('/chat');
};

const loadSession = async () => {
  thread.value = await api.getAgentChat(sessionId.value);
};

const handleEnterKey = (event: KeyboardEvent) => {
  if (!event.shiftKey) {
    sendMessage();
  }
};

const sendMessage = async () => {
  if (!inputMessage.value.trim()) {
    return;
  }

  const message = inputMessage.value.trim();
  inputMessage.value = '';

  const cleanup = await sendThreadMessage(message);
  if (cleanup) {
    sseCleanup = cleanup;
  }
};

const confirmDelete = () => {
  showDeleteDialog.value = true;
};

// Lifecycle
onMounted(() => {
  loadSession();
});

onUnmounted(() => {
  if (sseCleanup) {
    sseCleanup();
  }
});
</script>

<style scoped>
@import '@/styles/chat.css';
</style>