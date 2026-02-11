<template>
  <div class="chat-message">
    <template v-for="(part, index) in contentParts" :key="index">
      <ReasoningMessage
        v-if="part.type === 'reasoning'"
        :content="part.text"
      />
      <TextMessage
        v-if="part.type === 'text'"
        :role="message.role"
        :content="part.text"
        :turn="metadata?.turn"
        :user-label="userLabel"
        :agent-label="agentLabel"
      />
      <ToolCallMessage
        v-if="part.type === 'tool-call'"
        :tool-name="part.toolName"
        :args="part.args"
        :completed="completedToolCallIds.has(part.toolCallId)"
      />
      <!-- Tool results are shown inline on the tool-call block -->
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ModelMessage } from 'ai';
import TextMessage from './TextMessage.vue';
import ReasoningMessage from './ReasoningMessage.vue';
import ToolCallMessage from './ToolCallMessage.vue';
import { cleanToolArtifacts } from '@vox/utils/text-cleaning.js';

interface Props {
  message: ModelMessage;
  metadata?: {
    datetime: Date;
    turn: number;
  };
  userLabel?: string;
  agentLabel?: string;
}

const props = defineProps<Props>();

// Collect tool call IDs that have a matching tool-result
const completedToolCallIds = computed(() => {
  const ids = new Set<string>();
  if (Array.isArray(props.message.content)) {
    for (const part of props.message.content) {
      if (part.type === 'tool-result') {
        ids.add(part.toolCallId);
      }
    }
  }
  return ids;
});

// Normalize content to always be an array of parts, with reasoning parts first
// Tool-result parts are filtered out (their status is shown on the tool-call block)
const contentParts = computed(() => {
  const reasoningParts: any[] = [];
  const otherParts: any[] = [];

  if (typeof props.message.content === 'string') {
    const cleaned = cleanToolArtifacts(props.message.content);
    if (cleaned) otherParts.push({ type: 'text', text: cleaned });
  } else if (Array.isArray(props.message.content)) {
    for (const part of props.message.content) {
      if (part.type === 'reasoning') {
        reasoningParts.push(part);
      } else if (part.type === 'tool-result') {
        // Skip - shown inline on the tool-call block
      } else if (part.type === 'text') {
        const cleaned = cleanToolArtifacts(part.text);
        if (cleaned) otherParts.push({ ...part, text: cleaned });
      } else {
        otherParts.push(part);
      }
    }
  }

  return [...reasoningParts, ...otherParts];
});
</script>

<style scoped>
@import '@/styles/chat.css';
</style>