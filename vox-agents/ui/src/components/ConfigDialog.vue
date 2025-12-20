<script setup lang="ts">
/**
 * Configuration dialog component for creating and editing session configurations.
 * Provides a form interface for setting up session parameters including game mode,
 * auto-play settings, and player LLM assignments.
 */

import { ref, computed, watch } from 'vue';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Dropdown from 'primevue/dropdown';
import Checkbox from 'primevue/checkbox';
import InputNumber from 'primevue/inputnumber';
import Button from 'primevue/button';
import Card from 'primevue/card';
import type { StrategistSessionConfig } from '../utils/types';

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

// Game mode options
const gameModeOptions = [
  { label: 'Start New Game', value: 'start' },
  { label: 'Load Save', value: 'load' },
  { label: 'Wait for Game', value: 'wait' }
];

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
      localConfig.value = {
        name: `session_${new Date().toISOString().slice(0, 10)}`,
        type: 'strategist',
        autoPlay: false,
        gameMode: 'wait',
        llmPlayers: {
          0: {
            strategist: 'default',
            llms: {}
          }
        }
      };
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
  localConfig.value.llmPlayers[nextId] = {
    strategist: 'default',
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
      <!-- Configuration Name -->
      <Card class="config-section">
        <template #title>
          <i class="pi pi-tag" /> Configuration Name
        </template>
        <template #content>
          <div class="field-row">
            <InputText
              v-model="localName"
              :disabled="isEditMode"
              placeholder="Enter configuration name"
              class="config-name-input"
            />
            <span v-if="isEditMode" class="edit-mode-hint">
              <i class="pi pi-info-circle" /> Name cannot be changed in edit mode
            </span>
          </div>
        </template>
      </Card>

      <!-- Game Settings -->
      <Card class="config-section">
        <template #title>
          <i class="pi pi-cog" /> Game Settings
        </template>
        <template #content>
          <div class="settings-grid">
            <!-- Game Mode -->
            <div class="field-row">
              <label for="gameMode">Game Mode:</label>
              <Dropdown
                id="gameMode"
                v-model="localConfig.gameMode"
                :options="gameModeOptions"
                optionLabel="label"
                optionValue="value"
                class="field-input"
              />
            </div>

            <!-- Auto-play -->
            <div class="field-row">
              <label for="autoPlay">Auto-play:</label>
              <div class="checkbox-wrapper">
                <Checkbox
                  id="autoPlay"
                  v-model="localConfig.autoPlay"
                  :binary="true"
                />
                <label for="autoPlay" class="checkbox-label">
                  Enable automatic continuation when it's AI's turn
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
                placeholder="Number of games (optional)"
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
              class="player-row"
            >
              <span class="player-label">Player {{ playerId }}:</span>
              <InputText
                v-model="player.strategist"
                placeholder="Strategist type"
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

/* Override delete button to have auto margin in player rows */
.player-row .delete-btn {
  margin-left: auto;
}
</style>