<template>
  <div :class="`msg msg-${role} whitespace-pre`">
    <div class="flex justify-content-between align-items-center text-sm msg-header">
      <span class="font-semibold text-secondary">{{ displayRole }}</span>
    </div>
    {{ content }}
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
}

const props = defineProps<Props>();

const displayRole = computed(() => ({
  user: 'You',
  assistant: 'Agent',
  system: 'System',
  tool: 'Tool'
}[props.role] || props.role));
</script>

<style scoped>
@import '@/styles/chat.css';

.msg-header {
  margin-bottom: 0.5rem;
}
</style>