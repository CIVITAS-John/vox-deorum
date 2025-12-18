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
      />
      <ToolCallMessage
        v-if="part.type === 'tool-call'"
        :tool-name="part.toolName"
        :args="part.args"
      />
      <ToolResultMessage
        v-if="part.type === 'tool-result'"
        :tool-name="part.toolName"
        :result="part.result"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ModelMessage } from 'ai';
import TextMessage from './TextMessage.vue';
import ReasoningMessage from './ReasoningMessage.vue';
import ToolCallMessage from './ToolCallMessage.vue';
import ToolResultMessage from './ToolResultMessage.vue';

interface Props {
  message: ModelMessage;
}

const props = defineProps<Props>();

// Normalize content to always be an array of parts, with reasoning parts first
const contentParts = computed(() => {
  const parts: any[] = [];
  const reasoningParts: any[] = [];
  const otherParts: any[] = [];

  if (typeof props.message.content === 'string') {
    // Convert string to a single text part
    otherParts.push({ type: 'text', text: props.message.content });
  } else if (Array.isArray(props.message.content)) {
    // Separate reasoning parts from other parts
    for (const part of props.message.content) {
      if (part.type === 'reasoning') {
        reasoningParts.push(part);
      } else {
        otherParts.push(part);
      }
    }
  }

  // Reasoning parts first, then everything else
  return [...reasoningParts, ...otherParts];
});

const hasReasoningFirst = computed(() => {
  return contentParts.value.length > 0 && contentParts.value[0].type === 'reasoning';
});
</script>

<style scoped>
@import '@/styles/chat.css';
</style>