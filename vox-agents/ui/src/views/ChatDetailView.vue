<!--
View: ChatDetailView
Purpose: Main chat interface for interacting with agents
-->
<template>
  <div class="flex flex-column" style="height: 100%; overflow: hidden">
    <!-- Header -->
    <div style="flex-shrink: 0; padding: 1rem">
      <div class="flex justify-content-between align-items-center">
        <div class="flex align-items-center gap-3">
          <Button icon="pi pi-arrow-left" text rounded @click="goBack" />
          <h2 style="margin: 0">{{ thread?.title || `${thread?.agent || 'Loading'} Chat` }}</h2>
        </div>
        <div v-if="thread" class="flex align-items-center gap-2">
          <Tag :value="thread.contextType" :severity="thread.contextType === 'live' ? 'success' : 'info'" />
          <span class="text-sm text-muted">Game: {{ thread.gameID }} | Player: {{ thread.playerID }}</span>
          <Button
            icon="pi pi-trash"
            text
            severity="danger"
            rounded
            :loading="isDeleting"
            @click="confirmDelete"
          />
        </div>
      </div>
    </div>

    <!-- Messages -->
    <Card class="borderless" style="flex: 1; overflow: hidden">
      <template #content>
        <ChatMessages
          v-if="thread"
          :messages="thread.messages"
          :timestamps="messageTimestamps"
          :auto-scroll="!isStreaming"
        />
        <div v-else class="loading-container">
          <ProgressSpinner />
          <p>Loading chat session...</p>
        </div>
      </template>
    </Card>

    <!-- Input -->
    <div style="flex-shrink: 0; padding: 1rem">
      <div class="flex align-items-end gap-2">
        <Textarea
          v-model="inputMessage"
          :disabled="isStreaming || !thread"
          @keydown.enter.prevent="handleEnterKey"
          placeholder="Type your message..."
          :rows="3"
          auto-resize
          style="flex: 1"
        />
        <Button
          @click="sendMessage"
          :disabled="!inputMessage.trim() || isStreaming || !thread"
          :loading="isStreaming"
          icon="pi pi-send"
          label="Send"
        />
      </div>
      <div v-if="streamingStatus" class="text-sm" style="color: var(--p-primary-500); margin-top: 0.5rem">
        <i class="pi pi-spin pi-spinner"></i>
        {{ streamingStatus }}
      </div>
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
import Card from 'primevue/card';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';
import ProgressSpinner from 'primevue/progressspinner';
import { useToast } from 'primevue/usetoast';
import { api } from '../api/client';
import type { EnvoyThread, ChatRequest } from '../utils/types';
import type { ModelMessage } from 'ai';
import ChatMessages from '../components/chat/ChatMessages.vue';
import DeleteSessionDialog from '../components/DeleteSessionDialog.vue';

const route = useRoute();
const router = useRouter();
const toast = useToast();

// State
const thread = ref<EnvoyThread | null>(null);
const inputMessage = ref('');
const isStreaming = ref(false);
const streamingStatus = ref('');
const showDeleteDialog = ref(false);
const isDeleting = ref(false);
const messageTimestamps = ref<Date[]>([]);
let sseCleanup: (() => void) | null = null;

// Computed
const sessionId = computed(() => route.params.sessionId as string);

// Methods
const goBack = () => {
  router.push('/chat');
};

const loadSession = async () => {
  try {
    thread.value = await api.getAgentSession(sessionId.value);
    // Initialize timestamps for existing messages
    messageTimestamps.value = thread.value.messages.map(() => new Date());
  } catch (error) {
    console.error('Failed to load session:', error);
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to load chat session',
      life: 3000
    });
    goBack();
  }
};

const handleEnterKey = (event: KeyboardEvent) => {
  if (!event.shiftKey) {
    sendMessage();
  }
};

const sendMessage = async () => {
  if (!inputMessage.value.trim() || isStreaming.value || !thread.value) {
    return;
  }

  const message = inputMessage.value.trim();
  inputMessage.value = '';

  // Add user message to thread
  const userMessage: ModelMessage = {
    role: 'user',
    content: message
  };
  thread.value.messages.push(userMessage);
  messageTimestamps.value.push(new Date());

  // Start streaming
  isStreaming.value = true;
  streamingStatus.value = 'Connecting...';

  // Prepare for assistant response
  const assistantMessage: ModelMessage = {
    role: 'assistant',
    content: ''
  };
  thread.value.messages.push(assistantMessage);
  const assistantMsgIndex = thread.value.messages.length - 1;
  messageTimestamps.value.push(new Date());

  try {
    const request: ChatRequest = {
      sessionId: sessionId.value,
      message: message
    };

    // Set up SSE streaming
    let buffer = '';

    sseCleanup = api.streamAgentChat(
      request,
      (data) => {
        if (data.type === 'connected') {
          streamingStatus.value = 'Agent is thinking...';
        } else if (data.type === 'message') {
          streamingStatus.value = 'Agent is responding...';
          // Append chunk to the assistant message
          buffer += data;
          if (thread.value) {
            thread.value.messages[assistantMsgIndex] = {
              ...assistantMessage,
              content: buffer
            };
          }
        } else if (data.type === 'done') {
          streamingStatus.value = '';
          isStreaming.value = false;
        } else if (data.type === 'error') {
          throw new Error(data.message || 'Stream error');
        }
      },
      (error) => {
        console.error('SSE error:', error);
        streamingStatus.value = '';
        isStreaming.value = false;
        toast.add({
          severity: 'error',
          summary: 'Connection Error',
          detail: 'Lost connection to server',
          life: 3000
        });
      }
    );
  } catch (error) {
    console.error('Failed to send message:', error);
    streamingStatus.value = '';
    isStreaming.value = false;

    // Remove the empty assistant message
    thread.value.messages.pop();
    messageTimestamps.value.pop();

    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to send message',
      life: 3000
    });
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
@import '@/styles/states.css';
/* Component uses shared styles from chat.css and states.css */
</style>