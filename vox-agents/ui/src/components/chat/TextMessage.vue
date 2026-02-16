<template>
  <div :class="`msg msg-${role}`">
    <div class="flex justify-content-between align-items-center text-sm">
      <span class="font-semibold text-secondary">{{ displayRole }}</span>
      <span v-if="turn" class="text-muted text-xs ml-2">Turn {{ turn }}</span>
    </div>
    <div class="message-content" v-html="renderedContent"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface Props {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  turn?: number;
  userLabel?: string;
  agentLabel?: string;
}

const props = withDefaults(defineProps<Props>(), {
  userLabel: 'You',
  agentLabel: 'Agent'
});

const displayRole = computed(() => ({
  user: props.userLabel,
  assistant: props.agentLabel,
  system: 'System',
  tool: 'Tool'
}[props.role] || props.role));

const renderedContent = computed(() => {
  // Configure marked options for better rendering
  marked.setOptions({
    breaks: true, // Convert line breaks to <br>
    gfm: true,    // GitHub Flavored Markdown
  });

  // Strip LLM-echoed [Turn N] prefix and trailing horizontal rule
  const text = props.content
    .replace(/^\[Turn \d+\]\s*/, '')
    .replace(/\n\s*(?:---|<hr\s*\/?>)\s*$/, '');

  // Parse markdown and sanitize the HTML
  const html = marked(text);
  return DOMPurify.sanitize(html as string);
});
</script>

<style scoped>
@import '@/styles/chat.css';
</style>