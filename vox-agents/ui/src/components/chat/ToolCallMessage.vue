<template>
  <div class="tool-status" :class="{ 'tool-completed': completed }">
    <i v-if="!completed" class="pi pi-spin pi-spinner tool-status-icon" />
    <i v-else class="pi pi-check-circle tool-status-icon tool-success-icon" />
    <span class="tool-status-name">{{ toolName }}</span>
  </div>
</template>

<script setup lang="ts">
interface Props {
  toolName: string;
  args?: unknown;
  completed?: boolean;
}

defineProps<Props>();
</script>

<style scoped>
@import '@/styles/chat.css';
</style>