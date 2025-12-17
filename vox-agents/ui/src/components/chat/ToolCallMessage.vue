<template>
  <div class="msg msg-tool-call">
    <div class="tool-header">
      <span class="tool-icon">🔧</span>
      <span class="tool-name">{{ toolName }}</span>
    </div>
    <div v-if="formattedArgs" class="tool-args">
      <VueJsonPretty
        :data="formattedArgs"
        :show-icon="true"
        :show-line-number="false"
        :deep="2"
        :collapsed-on-click-brackets="true"
        :show-double-quotes="true"
        :virtual="false"
        :highlight-selected-node="false"
        class="json-pretty"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import VueJsonPretty from 'vue-json-pretty';
import 'vue-json-pretty/lib/styles.css';
import { computed } from 'vue';

interface Props {
  toolName: string;
  args?: unknown;
}

const props = defineProps<Props>();

// Ensure args conforms to JSONDataType
const formattedArgs = computed(() => {
  if (props.args === undefined || props.args === null) {
    return null;
  }
  // Cast to proper JSON type - the component expects structured JSON data
  return props.args as string | number | boolean | unknown[] | Record<string, unknown> | null;
});
</script>

<style scoped>
@import '@/styles/chat.css';
</style>