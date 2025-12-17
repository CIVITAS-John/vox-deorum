<script setup lang="ts">
/**
 * AgentSelectDialog component - modal dialog for selecting an agent
 * Used in ChatView, TelemetrySessionView, TelemetryDatabaseView, and TelemetryTraceView
 */

import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import ProgressSpinner from 'primevue/progressspinner';
import type { AgentInfo, ListAgentsResponse, Span, EnvoyThread } from '@/utils/types';
import { apiClient } from '@/api/client';

// Props interface
interface Props {
  visible: boolean;
  contextId?: string;
  databasePath?: string;
  turn?: number;
  span?: Span;  // Optional span for more precise context
}

// Emits interface
interface Emits {
  (e: 'update:visible', value: boolean): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();
const router = useRouter();

// State
const loading = ref(false);
const error = ref<string | null>(null);
const agents = ref<AgentInfo[]>([]);
const selectedAgent = ref<AgentInfo | null>(null);
const isCreatingSession = ref(false);

// Computed properties
const dialogVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value)
});

const contextType = computed(() => {
  if (props.contextId) return 'Active Game';
  if (props.databasePath) return 'Database';
  return 'No Context';
});

const contextName = computed(() => {
  if (props.contextId) {
    return props.contextId;
  } else if (props.databasePath) {
    return props.databasePath.split(/[/\\]/).pop() || props.databasePath;
  }
  return '';
});

const contextTurn = computed(() => {
  return props.span?.attributes?.turn || props.turn;
});

const contextSpanName = computed(() => {
  return props.span?.name || '';
});

// Filtered agents based on context
const filteredAgents = computed(() => {
  return agents.value.filter(agent => {
    // If session has contextId (active game), filter agents with "active-game" tag
    if (props.contextId && agent.tags.includes('active-game')) {
      return true;
    }

    // If session has databasePath (telepathist mode), filter agents with "telepathist" tag
    if (props.databasePath && agent.tags.includes('telepathist')) {
      return true;
    }

    return false;
  });
});

// Methods
async function loadAgents() {
  loading.value = true;
  error.value = null;

  try {
    const response = await apiClient.getAgents();
    agents.value = response.agents || [];
    console.log(response.agents);
  } catch (err) {
    console.error('Error loading agents:', err);
    error.value = err instanceof Error ? err.message : 'Failed to load agents';
  } finally {
    loading.value = false;
  }
}

function closeDialog() {
  dialogVisible.value = false;
  selectedAgent.value = null;
  error.value = null;
}

async function confirmSelection() {
  if (!selectedAgent.value) return;

  isCreatingSession.value = true;
  error.value = null;

  try {
    // Build the session creation request
    const request: any = {
      agentName: selectedAgent.value.name
    };

    // Add context based on what's provided
    if (props.contextId) {
      request.contextId = props.contextId;
    } else if (props.databasePath) {
      // Ensure proper path format
      const fullPath = props.databasePath.includes('/')
        ? props.databasePath
        : `telemetry/${props.databasePath}`;
      request.databasePath = fullPath;
    }

    // Add turn if provided (from props or span)
    const turn = props.span?.attributes?.turn || props.span?.turn || props.turn;
    if (turn !== undefined) {
      request.turn = turn;
    }

    // Create the session
    const session = await apiClient.createAgentSession(request);

    console.log('Created chat session:', {
      session,
      agent: selectedAgent.value,
      span: props.span,
      request
    });

    // Navigate to chat session (when route is implemented)
    // TODO: Uncomment when chat-session route is implemented
    // router.push({
    //   name: 'chat-session',
    //   params: { sessionId: session.id }
    // });
  } catch (err) {
    console.error('Failed to create chat session:', err);
    error.value = err instanceof Error ? err.message : 'Failed to create session';
  } finally {
    isCreatingSession.value = false;
  }
}

// Load agents when dialog opens
onMounted(() => {
  loadAgents();
});
</script>

<template>
  <Dialog
    v-model:visible="dialogVisible"
    modal
    :closable="true"
    :dismissableMask="true"
    :style="{ width: '60vw', minWidth: '640px' }"
    @hide="closeDialog"
  >
    <template #header>
      <h2>Select Agent</h2>
      <div class="context-tags">
        <Tag :value="contextType" severity="info" />
        <Tag v-if="contextName" :value="contextName" />
        <Tag v-if="contextTurn !== undefined" :value="`Turn ${contextTurn}`" severity="secondary" />
        <Tag v-if="contextSpanName" :value="contextSpanName" severity="contrast" />
      </div>
    </template>

    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <ProgressSpinner />
      <p>Loading available agents...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-container">
      <i class="pi pi-exclamation-triangle"></i>
      <p>{{ error }}</p>
      <Button label="Retry" @click="loadAgents" />
    </div>

    <!-- Agent Table -->
    <div v-else class="data-table">
      <!-- Header row -->
      <div class="table-header">
        <div class="col-fixed-150">Name</div>
        <div class="col-expand">Description</div>
        <div class="col-fixed-200">Tags</div>
      </div>

      <!-- Table body -->
      <div class="table-body">
        <div v-if="filteredAgents.length === 0" class="table-empty">
          <i class="pi pi-inbox"></i>
          <p>No agents available</p>
        </div>
        <div
          v-for="agent in filteredAgents"
          :key="agent.name"
          class="table-row clickable"
          :class="{ 'selected': selectedAgent?.name === agent.name }"
          @click="selectedAgent = agent"
        >
          <div class="col-fixed-150">{{ agent.name }}</div>
          <div class="col-expand">{{ agent.description }}</div>
          <div class="col-fixed-200">
            <Tag
              v-for="tag in agent.tags"
              :key="tag"
              :value="tag"
              class="mr-2"
            />
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <Button
        label="Cancel"
        severity="secondary"
        :disabled="isCreatingSession"
        @click="closeDialog"
      />
      <Button
        :label="isCreatingSession ? 'Creating Session...' : 'Select Agent'"
        :disabled="!selectedAgent || isCreatingSession"
        :loading="isCreatingSession"
        @click="confirmSelection"
      />
    </template>
  </Dialog>
</template>

<style scoped>
@import '@/styles/states.css';
@import '@/styles/data-table.css';

.context-tags {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.selected {
  font-weight: bold;
  background-color: var(--p-hover-background);
}
</style>