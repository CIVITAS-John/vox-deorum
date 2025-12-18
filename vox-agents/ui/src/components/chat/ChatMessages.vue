<template>
  <div class="chat-messages-container" ref="chatContainer">
    <div v-if="messages.length === 0" class="empty-state">
      <i class="pi pi-comments" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5"></i>
      <p>No messages yet. Start a conversation!</p>
    </div>

    <VList
      v-else
      ref="virtualScroller"
      :data="messages"
      :overscan="3"
      :style="{ minHeight: scrollerHeight }"
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
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue';
import { VList } from 'virtua/vue';
import Button from 'primevue/button';
import type { ModelMessage } from 'ai';
import ChatMessage from './ChatMessage.vue';

interface Props {
  messages: ModelMessage[];
  autoScroll?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  autoScroll: true
});

// Template refs
const virtualScroller = ref<InstanceType<typeof VList>>();
const chatContainer = ref<HTMLElement>();

// State
const showScrollButton = ref(false);
const scrollerHeight = ref('600px');

// Debounce timer
let resizeTimer: ReturnType<typeof setTimeout> | null = null;

// Calculate adaptive scroll height
const calculateScrollerHeight = () => {
  // Get viewport height and subtract approximate space for header, input area, padding
  const viewportHeight = window.innerHeight;
  const headerAndInputHeight = 300; // Approximate height for header, input area, and padding
  const calculatedHeight = Math.max(400, viewportHeight - headerAndInputHeight); // Minimum 400px
  scrollerHeight.value = `${calculatedHeight}px`;
};

// Update dimensions on window resize with debounce
const handleResize = () => {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    calculateScrollerHeight();
  }, 150); // Debounce for 150ms
};

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

// Watch for new messages to handle autoscroll
watch(() => props.messages, (newMessages, oldMessages) => {
  // Only autoscroll if there are new messages
  if (props.autoScroll && virtualScroller.value && newMessages.length > (oldMessages?.length ?? 0)) {
    nextTick(() => {
      scrollToBottom();
    });
  }
}, { deep: true });

onMounted(() => {
  calculateScrollerHeight();
  window.addEventListener('resize', handleResize);

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
  window.removeEventListener('resize', handleResize);

  // Clean up scroll listener
  const scrollElement = (virtualScroller.value as any)?.$el?.firstElementChild;
  if (scrollElement) {
    scrollElement.removeEventListener('scroll', handleScroll);
  }

  // Clear resize timer if it exists
  if (resizeTimer) {
    clearTimeout(resizeTimer);
  }
});
</script>

<style scoped>
@import '@/styles/chat.css';
@import '@/styles/states.css';

.chat-messages-container {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.virtual-list {
  flex: 1;
  overflow: auto;
}

.scroll-btn {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  z-index: 10;
}
</style>