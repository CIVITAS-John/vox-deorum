<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import Button from 'primevue/button';
import Message from 'primevue/message';
import Tag from 'primevue/tag';
import Toolbar from 'primevue/toolbar';
import ProgressSpinner from 'primevue/progressspinner';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import ConfigDialog from '../components/ConfigDialog.vue';
import GameModeDialog from '../components/GameModeDialog.vue';
import type { GameMode } from '../components/GameModeDialog.vue';
import { apiClient } from '../api/client';
import {
  sessionStatus,
  loading as sessionLoading,
  error as sessionError,
  fetchSessionStatus,
  stopSession,
  cleanup
} from '../stores/session';
import type { SessionConfig, SessionConfigsResponse, StrategistSessionConfig } from '../utils/types';

/**
 * Session Control view for managing game sessions and configurations
 */

// Local state
const configs = ref<SessionConfig[]>([]);
const loadingConfigs = ref(false);
const configError = ref<string | null>(null);
const selectedConfig = ref<SessionConfig | null>(null);

// Dialog state
const showConfigDialog = ref(false);
const configDialogMode = ref<'add' | 'edit'>('add');
const editingConfig = ref<StrategistSessionConfig | undefined>(undefined);
const editingConfigName = ref('');

// Game mode dialog state
const showGameModeDialog = ref(false);
const pendingConfig = ref<SessionConfig | null>(null);

// Starting session state
const startingSession = ref(false);

// Services
const confirm = useConfirm();
const toast = useToast();

/**
 * Get state color based on session state
 */
const stateColor = computed(() => {
  if (!sessionStatus.value?.session) return 'gray';

  const state = sessionStatus.value.session.state;
  switch (state) {
    case 'starting': return 'blue';
    case 'running': return 'green';
    case 'recovering': return 'orange';
    case 'stopping': return 'yellow';
    case 'stopped': return 'gray';
    case 'error': return 'red';
    default: return 'gray';
  }
});

/**
 * Get state severity for PrimeVue components
 */
const stateSeverity = computed(() => {
  if (!sessionStatus.value?.session) return undefined;

  const state = sessionStatus.value.session.state;
  switch (state) {
    case 'starting': return 'info';
    case 'running': return 'success';
    case 'recovering': return 'warning';
    case 'stopping': return 'warning';
    case 'stopped': return undefined;
    case 'error': return 'danger';
    default: return undefined;
  }
});

/**
 * Calculate elapsed time from session start
 */
const elapsedTime = computed(() => {
  if (!sessionStatus.value?.session?.startTime) return '';

  const start = new Date(sessionStatus.value.session.startTime);
  const now = new Date();
  const elapsed = Math.floor((now.getTime() - start.getTime()) / 1000);

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
});

/**
 * Load configurations from server
 */
async function loadConfigs() {
  loadingConfigs.value = true;
  configError.value = null;

  try {
    const response = await apiClient.getSessionConfigs();
    configs.value = response.configs;
  } catch (err: any) {
    configError.value = err.message || 'Failed to load configurations';
    console.error('Error loading configs:', err);
  } finally {
    loadingConfigs.value = false;
  }
}

/**
 * Show game mode dialog before starting session
 */
function showGameModeSelection(config: SessionConfig) {
  pendingConfig.value = config;
  showGameModeDialog.value = true;
}

/**
 * Start a new session with the given configuration and game mode
 */
async function startSessionWithGameMode(mode: GameMode) {
  if (!pendingConfig.value) return;

  startingSession.value = true;

  try {
    // Create a copy of the config with the selected game mode
    const configWithMode = {
      ...pendingConfig.value,
      gameMode: mode
    };

    await apiClient.startSession(configWithMode);
    await fetchSessionStatus();
    toast.add({
      severity: 'success',
      summary: 'Session Started',
      detail: `Game session started in ${mode} mode`,
      life: 3000
    });
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: 'Failed to Start',
      detail: err.message || 'Failed to start session',
      life: 5000
    });
  } finally {
    startingSession.value = false;
    pendingConfig.value = null;
  }
}

/**
 * Stop the current session with confirmation
 */
function confirmStopSession() {
  confirm.require({
    message: 'Are you sure you want to stop the current session?',
    header: 'Stop Session',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await stopSession();
        toast.add({
          severity: 'success',
          summary: 'Session Stopped',
          detail: 'Game session stopped successfully',
          life: 3000
        });
      } catch (err: any) {
        toast.add({
          severity: 'error',
          summary: 'Failed to Stop',
          detail: err.message || 'Failed to stop session',
          life: 5000
        });
      }
    }
  });
}

/**
 * Delete a configuration with confirmation
 */
function confirmDeleteConfig(config: SessionConfig) {
  // Use config name to derive filename
  const configFilename = `${config.name}.json`;

  confirm.require({
    message: `Are you sure you want to delete configuration "${config.name}"?`,
    header: 'Delete Configuration',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await apiClient.deleteSessionConfig(configFilename);
        await loadConfigs();
        toast.add({
          severity: 'success',
          summary: 'Configuration Deleted',
          detail: 'Configuration deleted successfully',
          life: 3000
        });
      } catch (err: any) {
        toast.add({
          severity: 'error',
          summary: 'Failed to Delete',
          detail: err.message || 'Failed to delete configuration',
          life: 5000
        });
      }
    }
  });
}

/**
 * Open the configuration dialog for adding or editing
 */
function openConfigDialog(mode: 'add' | 'edit', config?: SessionConfig) {
  configDialogMode.value = mode;

  if (mode === 'edit' && config) {
    editingConfig.value = config as StrategistSessionConfig;
    editingConfigName.value = config.name;
  } else {
    editingConfig.value = undefined;
    editingConfigName.value = '';
  }

  showConfigDialog.value = true;
}

/**
 * Handle configuration save from dialog
 */
async function handleConfigSave(name: string, config: StrategistSessionConfig) {
  try {
    // Ensure the config has the correct name
    config.name = name;

    await apiClient.saveSessionConfig(name, config);
    await loadConfigs();
    showConfigDialog.value = false;
    toast.add({
      severity: 'success',
      summary: 'Configuration Saved',
      detail: 'Configuration saved successfully',
      life: 3000
    });
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: 'Failed to Save',
      detail: err.message || 'Failed to save configuration',
      life: 5000
    });
  }
}


// Initialize on mount
onMounted(async () => {
  await Promise.all([
    fetchSessionStatus(),
    loadConfigs()
  ]);
});

// Cleanup on unmount
onUnmounted(() => {
  cleanup();
});
</script>

<template>
  <div class="session-view">
    <div class="page-header">
      <div class="page-header-left">
        <h1>Session Control</h1>
      </div>
    </div>

    <!-- Active Session Panel -->
    <div v-if="sessionStatus?.active && sessionStatus.session" class="panel-container mb-4">
      <Toolbar>
        <template #start>
          <h3>Active Session</h3>
          <Tag class="ml-2" :severity="stateSeverity" :value="sessionStatus.session.state.toUpperCase()" />
        </template>
        <template #end>
          <Button
            label="Stop Session"
            icon="pi pi-stop"
            severity="danger"
            size="small"
            @click="confirmStopSession"
            :loading="sessionLoading"
          />
        </template>
      </Toolbar>

      <div class="data-table">
        <!-- Session Details Table -->
        <div class="table-row" v-if="sessionStatus.session.config?.name">
          <div class="col-fixed-150">Configuration</div>
          <div class="col-expand">{{ sessionStatus.session.config.name }}</div>
        </div>
        <div class="table-row">
          <div class="col-fixed-150">Session ID</div>
          <div class="col-expand">{{ sessionStatus.session.id }}</div>
        </div>
        <div class="table-row" v-if="sessionStatus.session.gameID">
          <div class="col-fixed-150">Game ID</div>
          <div class="col-expand">{{ sessionStatus.session.gameID }}</div>
        </div>
        <div class="table-row" v-if="sessionStatus.session.turn !== undefined">
          <div class="col-fixed-150">Current Turn</div>
          <div class="col-expand">{{ sessionStatus.session.turn }}</div>
        </div>
        <div class="table-row" v-if="elapsedTime">
          <div class="col-fixed-150">Duration</div>
          <div class="col-expand">{{ elapsedTime }}</div>
        </div>
        <div class="table-row">
          <div class="col-fixed-150">Observe</div>
          <div class="col-expand">
            <i :class="sessionStatus.session.config.autoPlay ? 'pi pi-check text-green-500' : 'pi pi-times text-red-500'"></i>
            {{ sessionStatus.session.config.autoPlay ? 'Yes' : 'No' }}
          </div>
        </div>
        <div class="table-row">
          <div class="col-fixed-150">Game Mode</div>
          <div class="col-expand">{{ sessionStatus.session.config.gameMode }}</div>
        </div>
        <div class="table-row" v-if="sessionStatus.session.config.repetition">
          <div class="col-fixed-150">Repetitions</div>
          <div class="col-expand">{{ sessionStatus.session.config.repetition }}</div>
        </div>
        <div class="table-row error" v-if="sessionStatus.session.error">
          <div class="col-fixed-150">Error</div>
          <div class="col-expand text-wrap">{{ sessionStatus.session.error }}</div>
        </div>
      </div>
    </div>

    <!-- Session Error -->
    <Message v-if="sessionError" severity="error" :closable="false" class="mb-4">
      {{ sessionError }}
    </Message>

    <!-- Configurations Panel -->
    <div class="panel-container">
      <Toolbar>
        <template #start>
          <h3>Configurations</h3>
        </template>
        <template #end>
          <Button
            icon="pi pi-plus"
            label="New Config"
            severity="success"
            size="small"
            @click="openConfigDialog('add')"
          />
        </template>
      </Toolbar>

      <!-- Loading State -->
      <div v-if="loadingConfigs" class="table-loading">
        <ProgressSpinner />
        <span class="ml-2">Loading configurations...</span>
      </div>

      <!-- Error State -->
      <div v-else-if="configError" class="p-3">
        <Message severity="error" :closable="false">
          {{ configError }}
        </Message>
      </div>

      <!-- Empty State -->
      <div v-else-if="configs.length === 0" class="table-empty">
        <i class="pi pi-inbox"></i>
        <p>No configurations found</p>
        <Button
          label="Create First Config"
          icon="pi pi-plus"
          @click="openConfigDialog('add')"
        />
      </div>

      <!-- Configurations Table -->
      <div v-else class="data-table">
        <!-- Header row -->
        <div class="table-header">
          <div class="col-expand">Name</div>
          <div class="col-fixed-100">Type</div>
          <div class="col-fixed-80">Observe</div>
          <div class="col-fixed-200">Actions</div>
        </div>

        <!-- Table rows -->
        <div class="table-body">
          <div v-for="(config, index) in configs" :key="index" class="table-row">
            <div class="col-expand text-truncate">{{ config.name }}</div>
            <div class="col-fixed-100">
              <Tag value="Strategist" severity="info" />
            </div>
            <div class="col-fixed-80">
              <i :class="config.autoPlay ? 'pi pi-check text-green-500' : 'pi pi-times text-red-500'"></i>
            </div>
            <div class="col-fixed-200">
              <div class="flex gap-2">
                <Button
                  icon="pi pi-play"
                  severity="success"
                  size="small"
                  rounded
                  v-tooltip="'Start Session'"
                  @click="showGameModeSelection(config)"
                  :disabled="sessionStatus?.active || startingSession"
                  :loading="startingSession"
                />
                <Button
                  icon="pi pi-pencil"
                  severity="info"
                  size="small"
                  rounded
                  v-tooltip="'Edit Config'"
                  @click="openConfigDialog('edit', config)"
                />
                <Button
                  icon="pi pi-trash"
                  severity="danger"
                  size="small"
                  rounded
                  v-tooltip="'Delete Config'"
                  @click="confirmDeleteConfig(config)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Configuration Dialog -->
    <ConfigDialog
      v-model:visible="showConfigDialog"
      :mode="configDialogMode"
      :config="editingConfig"
      :configName="editingConfigName"
      @save="handleConfigSave"
    />

    <!-- Game Mode Dialog -->
    <GameModeDialog
      v-model:visible="showGameModeDialog"
      :loading="startingSession"
      @select="startSessionWithGameMode"
    />
  </div>
</template>

<style scoped>
@import '@/styles/data-table.css';
@import '@/styles/states.css';
@import '@/styles/panel.css';
</style>