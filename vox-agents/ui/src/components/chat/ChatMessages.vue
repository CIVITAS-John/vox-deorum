<template>
  <div class="flex flex-column h-full" style="position: relative">
    <div v-if="messages.length === 0" class="empty-state">
      <i class="pi pi-comments" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5"></i>
      <p>No messages yet. Start a conversation!</p>
    </div>

    <VList
      v-else
      ref="listRef"
      :data="messages"
      :overscan="3"
      class="virtual-list"
    >
      <template #default="{ item, index }">
        <ChatMessage
          :message="item"
          :timestamp="timestamps?.[index]"
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
  timestamps?: Date[];
  autoScroll?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  autoScroll: true
});

const listRef = ref<InstanceType<typeof VList>>();
const showScrollButton = ref(false);
let scrollContainer: HTMLElement | null = null;

const scrollToBottom = async () => {
  if (listRef.value && props.messages.length > 0) {
    await nextTick();
    listRef.value.scrollToIndex(props.messages.length - 1, {
      align: 'end',
      smooth: true
    });
  }
};

const handleScroll = () => {
  if (!scrollContainer) return;
  const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
  const atBottom = scrollHeight - scrollTop - clientHeight < 100;
  showScrollButton.value = !atBottom && props.messages.length > 5;
};

watch(() => props.messages.length, async (newLen, oldLen) => {
  if (newLen > oldLen && props.autoScroll) {
    await scrollToBottom();
  }
});

onMounted(() => {
  setTimeout(() => {
    scrollContainer = document.querySelector('.virtual-list > div') as HTMLElement;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
    }
    if (props.messages.length > 0) scrollToBottom();
  }, 100);
});

onUnmounted(() => {
  scrollContainer?.removeEventListener('scroll', handleScroll);
});
</script>

<style scoped>
@import '@/styles/chat.css';
@import '@/styles/states.css';
</style>