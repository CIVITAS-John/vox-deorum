<script setup lang="ts">
/**
 * AgentSelectDialog component - two-step modal dialog for selecting an agent and user identity.
 * Step 1: Select an agent from the filtered list.
 * Step 2: Configure user identity (role + player/civ affiliation).
 * Used in ChatView, TelemetrySessionView, TelemetryDatabaseView, and TelemetryTraceView.
 */

import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import ProgressSpinner from 'primevue/progressspinner';
import AutoComplete from 'primevue/autocomplete';
import Select from 'primevue/select';
import type { AgentInfo, Span, UserIdentity, CreateChatRequest } from '@/utils/types';
import { userRoleSuggestions } from '@/utils/types';
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

/** Option for the player/civ dropdown */
interface PlayerOption {
  label: string;
  value: number | 'observer';
}

// State
const loading = ref(false);
const error = ref<string | null>(null);
const agents = ref<AgentInfo[]>([]);
const selectedAgent = ref<AgentInfo | null>(null);
const isCreatingSession = ref(false);

// Step management
const currentStep = ref<'agent' | 'identity'>('agent');

// Identity form state
const userRole = ref('');
const filteredRoles = ref<string[]>([]);
const selectedPlayerOption = ref<PlayerOption | null>(null);
const playersLoading = ref(false);
const playerOptions = ref<PlayerOption[]>([]);

// Computed properties
const dialogVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value)
});

const dialogTitle = computed(() => {
  return currentStep.value === 'agent' ? 'Select Agent' : 'Your Identity';
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

/** Whether the Start Chat button should be enabled */
const canStartChat = computed(() => {
  return userRole.value.trim().length > 0 && selectedPlayerOption.value !== null;
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
  } catch (err) {
    console.error('Error loading agents:', err);
    error.value = err instanceof Error ? err.message : 'Failed to load agents';
  } finally {
    loading.value = false;
  }
}

/** Load player options for the identity step */
async function loadPlayerOptions() {
  const observerOption: PlayerOption = { label: 'Observer', value: 'observer' };

  // Only load real players for active game contexts
  if (!props.contextId) {
    playerOptions.value = [observerOption];
    return;
  }

  playersLoading.value = true;
  try {
    const response = await apiClient.getPlayersSummary();
    const options: PlayerOption[] = [];

    for (const [playerId, data] of Object.entries(response.players)) {
      if (typeof data === 'object' && data !== null) {
        options.push({
          label: `${data.Leader} of ${data.Civilization}`,
          value: parseInt(playerId)
        });
      }
    }

    options.push(observerOption);
    playerOptions.value = options;
  } catch (err) {
    console.error('Failed to load players:', err);
    // Gracefully degrade: show only observer
    playerOptions.value = [observerOption];
  } finally {
    playersLoading.value = false;
  }
}

/** Filter role suggestions for autocomplete */
function searchRoles(event: { query: string }) {
  const query = event.query.toLowerCase();
  filteredRoles.value = userRoleSuggestions.filter(
    role => role.toLowerCase().includes(query)
  );
}

/** Proceed from Step 1 to Step 2 */
function proceedToIdentity() {
  if (!selectedAgent.value) return;
  currentStep.value = 'identity';
  loadPlayerOptions();
}

function closeDialog() {
  dialogVisible.value = false;
  selectedAgent.value = null;
  currentStep.value = 'agent';
  userRole.value = '';
  selectedPlayerOption.value = null;
  error.value = null;
}

async function confirmSelection() {
  if (!selectedAgent.value || !canStartChat.value) return;

  isCreatingSession.value = true;
  error.value = null;

  try {
    // Build the session creation request
    const request: CreateChatRequest = {
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

    // Build user identity
    const identity: UserIdentity = {
      role: userRole.value.trim()
    };
    if (selectedPlayerOption.value && selectedPlayerOption.value.value !== 'observer') {
      identity.playerID = selectedPlayerOption.value.value as number;
      identity.displayName = selectedPlayerOption.value.label;
    } else {
      identity.displayName = 'Observer';
    }
    request.userIdentity = identity;

    // Create the chat thread
    const session = await apiClient.createAgentChat(request);

    console.log('Created chat thread:', {
      session,
      agent: selectedAgent.value,
      span: props.span,
      request
    });

    // Navigate to chat session
    router.push({
      name: 'chat-detail',
      params: { sessionId: session.id }
    });

    // Close dialog after navigation
    closeDialog();
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
      <h2>{{ dialogTitle }}</h2>
      <div class="context-tags">
        <Tag :value="contextType" severity="info" />
        <Tag v-if="contextName" :value="contextName" />
        <Tag v-if="contextTurn !== undefined" :value="`Turn ${contextTurn}`" severity="secondary" />
        <Tag v-if="contextSpanName" :value="contextSpanName" severity="contrast" />
      </div>
    </template>

    <!-- Step 1: Agent Selection -->
    <template v-if="currentStep === 'agent'">
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
          <div class="col-fixed-250">Tags</div>
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
            <div class="col-expand description-col">{{ agent.description }}</div>
            <div class="col-fixed-250">
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
    </template>

    <!-- Step 2: User Identity -->
    <template v-else-if="currentStep === 'identity'">
      <!-- Error State -->
      <div v-if="error" class="error-container">
        <i class="pi pi-exclamation-triangle"></i>
        <p>{{ error }}</p>
      </div>

      <div class="identity-step">
        <div class="identity-form">
          <label for="user-role">Your Role</label>
          <AutoComplete
            id="user-role"
            v-model="userRole"
            :suggestions="filteredRoles"
            @complete="searchRoles"
            placeholder="e.g., a diplomat, the leader, a military general..."
            :dropdown="true"
          />

          <label for="user-player">Representing</label>
          <Select
            id="user-player"
            v-model="selectedPlayerOption"
            :options="playerOptions"
            optionLabel="label"
            placeholder="Select a player or observer..."
            :loading="playersLoading"
          />
        </div>
      </div>
    </template>

    <template #footer>
      <!-- Step 1 footer -->
      <template v-if="currentStep === 'agent'">
        <Button
          label="Cancel"
          severity="secondary"
          @click="closeDialog"
        />
        <Button
          label="Next"
          :disabled="!selectedAgent"
          @click="proceedToIdentity"
        />
      </template>

      <!-- Step 2 footer -->
      <template v-else>
        <Button
          label="Back"
          severity="secondary"
          :disabled="isCreatingSession"
          @click="currentStep = 'agent'"
        />
        <Button
          :label="isCreatingSession ? 'Creating Session...' : 'Start Chat'"
          :disabled="!canStartChat || isCreatingSession"
          :loading="isCreatingSession"
          @click="confirmSelection"
        />
      </template>
    </template>
  </Dialog>
</template>

<style scoped>
@import '@/styles/states.css';
@import '@/styles/data-table.css';

.context-tags {
  display: flex;
  gap: 0.5rem;
}

.selected {
  font-weight: bold;
  background-color: var(--p-hover-background);
}

/* Multi-line description support */
.description-col {
  white-space: pre-wrap !important;
  word-wrap: break-word;
  overflow: visible !important;
  text-overflow: unset !important;
}

/* Identity step styles */
.identity-step {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.identity-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.identity-form label {
  font-weight: 600;
  color: var(--p-text-color);
}
</style>
