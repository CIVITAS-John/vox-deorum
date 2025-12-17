<template>
  <div class="msg msg-tool-result">
    <div class="tool-header">
      <span class="tool-icon">✅</span>
      <span class="tool-name">Result: {{ toolName }}</span>
    </div>
    <div v-if="formattedResult" class="tool-result-content">
      <div v-if="typeof formattedResult === 'string'" class="text-result">
        {{ formattedResult }}
      </div>
      <VueJsonPretty
        v-else
        :data="formattedResult"
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
  result?: unknown;
}

const props = defineProps<Props>();

// Ensure result conforms to JSONDataType
const formattedResult = computed(() => {
  if (props.result === undefined || props.result === null) {
    return null;
  }
  // Cast to proper JSON type - the component expects structured JSON data
  return props.result as string | number | boolean | unknown[] | Record<string, unknown> | null;
});
</script>

<style scoped>
@import '@/styles/chat.css';

/* Additional specific style for success color in header */
.msg-tool-result .tool-header {
  color: var(--p-green-600);
}
</style>