<script setup lang="ts">
/**
 * Configuration dialog component for creating and editing session configurations.
 * Provides a form interface for setting up session parameters including game mode,
 * auto-play settings, and player LLM assignments.
 */

import { ref, computed, watch, onMounted } from 'vue';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Dropdown from 'primevue/dropdown';
import Checkbox from 'primevue/checkbox';
import InputNumber from 'primevue/inputnumber';
import Button from 'primevue/button';
import Card from 'primevue/card';
import type { StrategistSessionConfig, AgentInfo } from '../utils/types';
import { apiClient } from '../api/client';

// Props
const props = defineProps<{
  visible: boolean;
  mode: 'add' | 'edit';
  config?: StrategistSessionConfig;
  configName?: string;
}>();

// Emits
const emit = defineEmits<{
  'update:visible': [value: boolean];
  'save': [name: string, config: StrategistSessionConfig];
}>();

// Local state for editing
const localConfig = ref<StrategistSessionConfig>({
  name: '',
  type: 'strategist',
  autoPlay: false,
  gameMode: 'wait',
  llmPlayers: {}
});

const localName = ref('');
const strategistOptions = ref<{ label: string; value: string }[]>([]);
const loadingStrategists = ref(false);

// Computed properties
const dialogTitle = computed(() =>
  props.mode === 'add' ? 'New Configuration' : 'Edit Configuration'
);

const isEditMode = computed(() => props.mode === 'edit');

// Watch for prop changes to update local state
watch(() => props.visible, (newVal) => {
  if (newVal) {
    if (props.mode === 'add') {
      // Reset to default config for new
      const defaultStrategist = strategistOptions.value[0]!.value;
      localConfig.value = {
        name: `session-${new Date().toISOString().slice(0, 10)}`,
        type: 'strategist',
        autoPlay: false,
        gameMode: 'wait',
        llmPlayers: {}
      };
      addPlayer();
      localName.value = localConfig.value.name;
    } else if (props.config) {
      // Copy config for editing
      localConfig.value = JSON.parse(JSON.stringify(props.config));
      localName.value = props.configName || props.config.name;
    }
  }
});

/**
 * Add a new player to the configuration
 */
function addPlayer() {
  const nextId = Math.max(-1, ...Object.keys(localConfig.value.llmPlayers).map(Number)) + 1;
  const defaultStrategist = strategistOptions.value[0]!.value;
  localConfig.value.llmPlayers[nextId] = {
    strategist: defaultStrategist,
    llms: {}
  };
}

/**
 * Remove a player from the configuration
 */
function removePlayer(playerId: number) {
  delete localConfig.value.llmPlayers[playerId];
}

/**
 * Handle save action
 */
function handleSave() {
  // Update the config name from the input (only in add mode)
  if (props.mode === 'add') {
    localConfig.value.name = localName.value;
  }

  emit('save', localName.value, localConfig.value);
}

/**
 * Handle dialog close
 */
function handleClose() {
  emit('update:visible', false);
}

/**
 * Load available strategist agents
 */
async function loadStrategistOptions() {
  loadingStrategists.value = true;
  try {
    const response = await apiClient.getAgents();
    // Filter for strategist agents (those with 'strategist' tag or in their name)
    const strategists = response.agents.filter(agent =>
      agent.tags.includes('strategist') ||
      agent.name.toLowerCase().includes('strategist')
    );

    // Convert to dropdown options
    strategistOptions.value = strategists.map(agent => ({
      label: `${agent.name} - ${agent.description}`,
      value: agent.name
    }));
  } catch (error) {
    console.error('Failed to load strategist options:', error);
  } finally {
    loadingStrategists.value = false;
  }
}

// Load strategist options on mount
onMounted(() => {
  loadStrategistOptions();
});
</script>

<template>
  <Dialog
    :visible="visible"
    :header="dialogTitle"
    :modal="true"
    :style="{ width: '700px' }"
    @update:visible="handleClose"
  >
    <div class="config-dialog-content">
      <!-- Game Settings -->
      <Card class="config-section">
        <template #content>
          <div class="settings-grid">
            <div class="field-row">
              <label for="autoPlay">Name: </label>
              <InputText
                v-model="localName"
                :disabled="isEditMode"
                placeholder="Enter configuration name"
                class="config-name-input"
              />
            </div>
            <!-- Auto-play -->
            <div class="field-row">
              <label for="autoPlay">Observe:</label>
              <div class="checkbox-wrapper">
                <Checkbox
                  id="autoPlay"
                  v-model="localConfig.autoPlay"
                  :binary="true"
                />
                <label for="autoPlay" class="checkbox-label">
                  Enable observation mode when starting the session
                </label>
              </div>
            </div>
            <!-- Repetitions -->
            <div class="field-row">
              <label for="repetition">Repetitions:</label>
              <InputNumber
                id="repetition"
                v-model="localConfig.repetition"
                :min="1"
                :max="100"
                placeholder="# of auto-repeated games (for research only)"
                class="field-input"
              />
            </div>
          </div>
        </template>
      </Card>

      <!-- LLM Players -->
      <Card class="config-section">
        <template #title>
          <i class="pi pi-users" /> LLM Players
          <Button
            label="Add Player"
            icon="pi pi-plus"
            text
            size="small"
            @click="addPlayer"
            style="margin-left: auto"
          />
        </template>
        <template #content>
          <div class="players-list">
            <div v-if="Object.keys(localConfig.llmPlayers).length === 0" class="empty-state">
              <i class="pi pi-user-plus" />
              <p>No players configured. Click "Add Player" to add one.</p>
            </div>
            <div
              v-for="(player, playerId) in localConfig.llmPlayers"
              :key="playerId"
              class="field-row"
            >
              <span class="player-label">Player {{ playerId }}:</span>
              <Dropdown
                v-model="player.strategist"
                :options="strategistOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Select strategist"
                :loading="loadingStrategists"
                class="strategist-input"
              />
              <Button
                icon="pi pi-trash"
                severity="danger"
                text
                @click="removePlayer(Number(playerId))"
                class="delete-btn"
              />
            </div>
          </div>
        </template>
      </Card>
    </div>

    <!-- Dialog Footer -->
    <template #footer>
      <Button
        label="Cancel"
        icon="pi pi-times"
        @click="handleClose"
        text
      />
      <Button
        label="Save"
        icon="pi pi-check"
        @click="handleSave"
        :disabled="!localName.trim()"
      />
    </template>
  </Dialog>
</template>

<style scoped>
/* Import shared styles */
@import '@/styles/states.css';
@import '@/styles/config.css';

/* Dialog specific styles */
.config-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* Override delete button to have auto margin in field rows */
.field-row .delete-btn {
  margin-left: auto;
}
</style>