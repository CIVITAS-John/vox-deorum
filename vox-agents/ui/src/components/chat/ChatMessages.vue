<template>
  <div class="chat-messages-container">
    <div v-if="messages.length === 0" class="empty-state">
      <i class="pi pi-comments" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5"></i>
      <p>No messages yet. Start a conversation!</p>
    </div>

    <VList
      v-else
      ref="virtualScroller"
      :data="messages"
      :overscan="3"
      class="virtual-list"
    >
      <template #default="{ item, index }">
        <ChatMessage
          :key="`${item.role}-${index}`"
          :message="item"
        />
      </template>
    </VList>

    <Button
      v-if="showScrollButton"
      @click="scrollToBottom"
      icon="pi pi-arrow-down"
      rounded
      severity="secondary"
      class="scroll-btn"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { VList } from 'virtua/vue';
import Button from 'primevue/button';
import type { ModelMessage } from 'ai';
import ChatMessage from './ChatMessage.vue';

interface Props {
  messages: ModelMessage[];
  autoScroll?: boolean;
  scrollTrigger?: number;
}

const props = withDefaults(defineProps<Props>(), {
  autoScroll: true,
  scrollTrigger: 0
});

// Template refs
const virtualScroller = ref<InstanceType<typeof VList>>();

// State
const showScrollButton = ref(false);

// Scroll to bottom of the list
const scrollToBottom = () => {
  const targetIndex = props.messages.length - 1;
  if (virtualScroller.value && targetIndex >= 0) {
    requestAnimationFrame(() => {
      // Virtua uses scrollToIndex method directly on the ref
      virtualScroller.value!.scrollToIndex(targetIndex);
    });
  }
};

// Handle scroll events to show/hide scroll button
const handleScroll = () => {
  if (!virtualScroller.value) return;

  // Get the internal scroll container from Virtua
  const scrollElement = (virtualScroller.value as any)?.$el?.firstElementChild;
  if (!scrollElement) return;

  const { scrollTop, scrollHeight, clientHeight } = scrollElement;
  const atBottom = scrollHeight - scrollTop - clientHeight < 100;
  showScrollButton.value = !atBottom && props.messages.length > 5;
};

// Watch for scroll trigger events to handle autoscroll
watch(() => props.scrollTrigger, () => {
  // Scroll to bottom when a new meaningful chunk is received
  if (props.autoScroll && virtualScroller.value && props.messages.length > 0) {
    nextTick(() => {
      scrollToBottom();
    });
  }
});

onMounted(() => {
  // Wait for next tick to ensure virtual scroller is rendered
  nextTick(() => {
    // Get the internal scroll container from Virtua and add scroll listener
    const scrollElement = (virtualScroller.value as any)?.$el?.firstElementChild;
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleScroll);
    }

    // Initial scroll to bottom if messages exist
    if (props.messages.length > 0 && props.autoScroll) {
      scrollToBottom();
    }
  });
});

onUnmounted(() => {
  // Clean up scroll listener
  const scrollElement = (virtualScroller.value as any)?.$el?.firstElementChild;
  if (scrollElement) {
    scrollElement.removeEventListener('scroll', handleScroll);
  }
});
</script>

<style scoped>
@import '@/styles/chat.css';
</style>