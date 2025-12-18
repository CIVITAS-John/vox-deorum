<template>
  <div :class="`msg msg-${role}`">
    <div class="flex justify-content-between align-items-center text-sm">
      <span class="font-semibold text-secondary">{{ displayRole }}</span>
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
}

const props = defineProps<Props>();

const displayRole = computed(() => ({
  user: 'You',
  assistant: 'Agent',
  system: 'System',
  tool: 'Tool'
}[props.role] || props.role));

const renderedContent = computed(() => {
  // Configure marked options for better rendering
  marked.setOptions({
    breaks: true, // Convert line breaks to <br>
    gfm: true,    // GitHub Flavored Markdown
  });

  // Parse markdown and sanitize the HTML
  const html = marked(props.content);
  return DOMPurify.sanitize(html as string);
});
</script>

<style scoped>
@import '@/styles/chat.css';
</style>