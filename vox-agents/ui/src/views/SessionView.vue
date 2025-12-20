<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import Card from 'primevue/card';
import Button from 'primevue/button';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Message from 'primevue/message';
import Tag from 'primevue/tag';
import ProgressSpinner from 'primevue/progressspinner';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import ConfigDialog from '../components/ConfigDialog.vue';
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
    case 'running': return 'green';
    case 'paused': return 'orange';
    case 'error': return 'red';
    case 'stopping': return 'yellow';
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
    case 'running': return 'success';
    case 'paused': return 'warning';
    case 'error': return 'danger';
    case 'stopping': return 'warning';
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
 * Start a new session with the given configuration
 */
async function startSessionWithConfig(config: SessionConfig) {
  startingSession.value = true;

  try {
    await apiClient.startSession(config);
    await fetchSessionStatus();
    toast.add({
      severity: 'success',
      summary: 'Session Started',
      detail: 'Game session started successfully',
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
      <h1>Session Control</h1>
    </div>

    <!-- Active Session Card -->
    <Card v-if="sessionStatus?.active && sessionStatus.session" class="mb-4">
      <template #title>
        <div class="flex align-items-center gap-2">
          <i class="pi pi-circle-fill" :style="{ color: stateColor }"></i>
          Active Session
        </div>
      </template>
      <template #content>
        <div class="grid">
          <!-- Session Info -->
          <div class="col-12 md:col-6">
            <div class="mb-2">
              <strong>Session ID:</strong> {{ sessionStatus.session.id }}
            </div>
            <div class="mb-2">
              <strong>Type:</strong> {{ sessionStatus.session.type }}
            </div>
            <div class="mb-2">
              <strong>State:</strong>
              <Tag :severity="stateSeverity" :value="sessionStatus.session.state.toUpperCase()" />
            </div>
            <div class="mb-2" v-if="elapsedTime">
              <strong>Duration:</strong> {{ elapsedTime }}
            </div>
          </div>

          <!-- Session Config -->
          <div class="col-12 md:col-6">
            <div class="mb-2">
              <strong>Auto-play:</strong> {{ sessionStatus.session.config.autoPlay ? 'Yes' : 'No' }}
            </div>
            <div class="mb-2">
              <strong>Game Mode:</strong> {{ sessionStatus.session.config.gameMode }}
            </div>
            <div class="mb-2" v-if="sessionStatus.session.config.repetition">
              <strong>Repetitions:</strong> {{ sessionStatus.session.config.repetition }}
            </div>
          </div>

          <!-- Error Message -->
          <div class="col-12" v-if="sessionStatus.session.error">
            <Message severity="error" :closable="false">
              {{ sessionStatus.session.error }}
            </Message>
          </div>

          <!-- Session Controls -->
          <div class="col-12">
            <div class="flex gap-2">
              <Button
                label="Stop Session"
                icon="pi pi-stop"
                severity="danger"
                @click="confirmStopSession"
                :loading="sessionLoading"
              />
            </div>
          </div>
        </div>
      </template>
    </Card>

    <!-- Session Error -->
    <Message v-if="sessionError" severity="error" :closable="false" class="mb-4">
      {{ sessionError }}
    </Message>

    <!-- Configurations Card -->
    <Card>
      <template #title>
        <div class="flex justify-content-between align-items-center">
          <span>Configurations</span>
          <Button
            icon="pi pi-plus"
            label="New Config"
            severity="success"
            @click="openConfigDialog('add')"
            :disabled="sessionStatus?.active"
          />
        </div>
      </template>
      <template #content>
        <!-- Loading State -->
        <div v-if="loadingConfigs" class="flex justify-content-center p-4">
          <ProgressSpinner />
        </div>

        <!-- Error State -->
        <Message v-else-if="configError" severity="error" :closable="false">
          {{ configError }}
        </Message>

        <!-- Empty State -->
        <div v-else-if="configs.length === 0" class="text-center p-4">
          <i class="pi pi-inbox text-4xl text-400 mb-3"></i>
          <p class="text-600">No configurations found.</p>
          <Button
            label="Create First Config"
            icon="pi pi-plus"
            @click="openConfigDialog('add')"
            :disabled="sessionStatus?.active"
          />
        </div>

        <!-- Configurations List -->
        <DataTable v-else :value="configs" responsiveLayout="scroll">
          <Column field="name" header="Name">
            <template #body="{ data }">
              {{ data.name }}
            </template>
          </Column>
          <Column field="type" header="Type">
            <template #body="{ data }">
              <Tag value="Strategist" />
            </template>
          </Column>
          <Column field="gameMode" header="Game Mode">
            <template #body="{ data }">
              {{ data.gameMode }}
            </template>
          </Column>
          <Column field="autoPlay" header="Auto-play">
            <template #body="{ data }">
              <i :class="data.autoPlay ? 'pi pi-check text-green-500' : 'pi pi-times text-red-500'"></i>
            </template>
          </Column>
          <Column header="LLM Players">
            <template #body="{ data }">
              {{ Object.keys(data.llmPlayers || {}).length }} players
            </template>
          </Column>
          <Column header="Actions" style="width: 200px">
            <template #body="{ data, index }">
              <div class="flex gap-2">
                <Button
                  icon="pi pi-play"
                  severity="success"
                  @click="startSessionWithConfig(data)"
                  :disabled="sessionStatus?.active || startingSession"
                  :loading="startingSession"
                />
                <Button
                  icon="pi pi-pencil"
                  severity="info"
                  @click="openConfigDialog('edit', data)"
                  :disabled="sessionStatus?.active"
                />
                <Button
                  icon="pi pi-trash"
                  severity="danger"
                  @click="confirmDeleteConfig(data)"
                  :disabled="sessionStatus?.active"
                />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <!-- Configuration Dialog -->
    <ConfigDialog
      v-model:visible="showConfigDialog"
      :mode="configDialogMode"
      :config="editingConfig"
      :configName="editingConfigName"
      @save="handleConfigSave"
    />
  </div>
</template>

<style scoped>
</style>