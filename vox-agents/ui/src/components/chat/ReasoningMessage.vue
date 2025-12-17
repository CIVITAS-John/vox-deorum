<template>
  <div class="collapsible">
    <div class="collapsible-header" @click="isExpanded = !isExpanded">
      <i :class="isExpanded ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"></i>
      <span class="font-semibold text-sm">{{ title }}</span>
      <span v-if="!isExpanded" class="text-sm text-muted collapsible-preview">
        {{ content.substring(0, 100) }}{{ content.length > 100 ? '...' : '' }}
      </span>
    </div>
    <div v-if="isExpanded" class="collapsible-content text-sm whitespace-pre">
      {{ content }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface Props {
  content: string;
  title?: string;
}

withDefaults(defineProps<Props>(), {
  title: 'Reasoning'
});

const isExpanded = ref(false);
</script>

<style scoped>
@import '@/styles/chat.css';

.collapsible-preview {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>