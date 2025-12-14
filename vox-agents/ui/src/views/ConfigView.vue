<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import Card from 'primevue/card';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';
import Dropdown from 'primevue/dropdown';
import { useConfirm } from 'primevue/useconfirm';
import { apiClient } from '../api/client';
import type { AgentMapping, ModelDefinition, VoxAgentsConfig } from '../api/config-types';
import { llmProviders, apiKeyFields } from '../api/config-types';
import {
  parseLLMConfig,
  buildLLMConfig,
  updateModelId,
  getAgentsUsingModel,
  validateMappings
} from '../utils/config-utils';

// State
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const success = ref(false);
const apiKeys = ref<Record<string, string>>({});
const config = ref<VoxAgentsConfig | null>(null);

// LLM Configuration State
const agentMappings = ref<AgentMapping[]>([]);
const modelDefinitions = ref<ModelDefinition[]>([]);

// Initialize confirmation service
const confirm = useConfirm();

// Computed available models for dropdown
const availableModels = computed(() => {
  return modelDefinitions.value.map(m => ({
    label: m.id,
    value: m.id
  }));
});

// Load configuration on mount
onMounted(async () => {
  await loadConfig();
});

// Load configuration from server
async function loadConfig() {
  loading.value = true;
  error.value = null;

  try {
    const data = await apiClient.getCurrentConfig();

    // Initialize API keys with empty strings for missing keys
    const loadedKeys: Record<string, string> = {};
    for (const field of apiKeyFields) {
      loadedKeys[field.key] = data.apiKeys[field.key] || '';
    }
    apiKeys.value = loadedKeys;

    // Parse LLM configuration
    const { mappings, definitions } = parseLLMConfig(data.config.llms || {});
    agentMappings.value = mappings;
    modelDefinitions.value = definitions;

    // Keep other parts
    config.value = data.config;
  } catch (err: any) {
    error.value = err.message || 'Failed to load configuration';
    console.error('Error loading config:', err);
  } finally {
    loading.value = false;
  }
}

// LLM Configuration Functions
function addMapping() {
  agentMappings.value.push({
    agent: '',
    model: availableModels.value[0]?.value || ''
  });
}

function deleteMapping(index: number) {
  agentMappings.value.splice(index, 1);
}

function addModel() {
  modelDefinitions.value.push({
    id: '',
    provider: 'openrouter',
    name: ''
  });
}

function confirmDeleteModel(modelId: string) {
  const inUse = getAgentsUsingModel(modelId, agentMappings.value);

  if (inUse.length > 0) {
    confirm.require({
      message: `This model is used by the following agents: ${inUse.join(', ')}. Deleting this model will also remove these assignments. Do you want to continue?`,
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      rejectClass: 'p-button-text',
      acceptClass: 'p-button-danger',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      accept: () => deleteModel(modelId)
    });
  } else {
    deleteModel(modelId);
  }
}

function deleteModel(modelId: string) {
  // Remove from definitions
  const index = modelDefinitions.value.findIndex(m => m.id === modelId);
  if (index !== -1) {
    modelDefinitions.value.splice(index, 1);
  }

  // Remove any mappings using this model
  agentMappings.value = agentMappings.value.filter(m => m.model !== modelId);
}

// Save configuration (API keys and config)
async function saveConfig() {
  saving.value = true;
  error.value = null;
  success.value = false;

  try {
    // Validate mappings before saving
    const validation = validateMappings(agentMappings.value, modelDefinitions.value);
    if (!validation.valid) {
      error.value = validation.errors.join('. ');
      saving.value = false;
      return;
    }

    // Filter out empty API key values
    const nonEmptyKeys = Object.fromEntries(
      Object.entries(apiKeys.value).filter(([_, value]) => value !== '')
    );

    // Build the updated config with LLM settings
    const updatedConfig = {
      ...config.value!,
      llms: buildLLMConfig(agentMappings.value, modelDefinitions.value)
    };

    await apiClient.updateCurrentConfig({
      apiKeys: nonEmptyKeys,
      config: updatedConfig
    });

    success.value = true;
    setTimeout(() => {
      success.value = false;
    }, 3000);
  } catch (err: any) {
    error.value = err.message || 'Failed to save configuration';
    console.error('Error saving config:', err);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="config-view">
    <!-- Page Header with Title and Actions -->
    <div class="page-header">
      <div class="page-header-left">
        <h1>Configuration Management</h1>
        <!-- Loading Spinner Icon -->
        <ProgressSpinner v-if="loading" style="width: 24px; height: 24px" />
      </div>
      <div class="page-header-controls">
        <Button
          label="Reload"
          icon="pi pi-refresh"
          text
          @click="loadConfig"
          :disabled="loading || saving"
        />
        <Button
          label="Save All"
          icon="pi pi-save"
          severity="success"
          @click="saveConfig"
          :loading="saving"
          :disabled="loading"
        />
      </div>
    </div>

    <!-- Status Messages -->
    <div class="status-messages" v-if="success || error">
      <!-- Success Message -->
      <Message v-if="success" severity="success" :closable="false">
        Saved successfully
      </Message>
      <!-- Error Message -->
      <Message v-if="error" severity="error" :closable="true" @close="error = null">
        {{ error }}
      </Message>
    </div>

    <!-- Main Content -->
    <!-- LLM API Keys Section -->
    <Card class="config-card">
      <template #title>
        <i class="pi pi-key" /> API Keys
      </template>
      <template #subtitle>
        API keys are stored locally in your .env file
      </template>
      <template #content>
        <table class="api-keys-table">
          <tbody>
            <tr v-for="field in apiKeyFields" :key="field.key">
              <td class="label-cell">
                <label :for="field.key">{{ field.label }}</label>
              </td>
              <td class="input-cell">
                <Password
                  v-if="field.type === 'password'"
                  :id="field.key"
                  v-model="apiKeys[field.key]"
                  :placeholder="`Enter ${field.label}`"
                  toggleMask
                  :feedback="false"
                />
                <InputText
                  v-else
                  :id="field.key"
                  v-model="apiKeys[field.key]"
                  :placeholder="field.placeholder || `Enter ${field.label}`"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </template>
    </Card>

    <!-- Card 1: Agent-Model Mappings -->
    <Card class="config-card">
      <template #title>
        <i class="pi pi-link" /> Agent-Model Assignments
        <Button
          label="Add Mapping"
          icon="pi pi-plus"
          text
          size="small"
          @click="addMapping"
          :disabled="availableModels.length === 0"
          style="margin-left: auto"
        />
      </template>
      <template #subtitle>
        If you need to use other models, add model configurations below.
      </template>
      <template #content>
        <div class="mappings-list">
          <div v-for="(mapping, index) in agentMappings" :key="index" class="mapping-row">
            <InputText
              v-model="mapping.agent"
              placeholder="Agent name (e.g., default)"
              class="agent-input"
            />
            <Dropdown
              v-model="mapping.model"
              :options="availableModels"
              optionLabel="label"
              optionValue="value"
              placeholder="Select model"
              class="model-dropdown"
              :disabled="availableModels.length === 0"
            />
            <Button
              icon="pi pi-trash"
              text
              severity="danger"
              @click="deleteMapping(index)"
              class="delete-btn"
            />
          </div>
        </div>
      </template>
    </Card>

    <!-- Card 2: Model Definitions -->
    <Card class="config-card">
      <template #title>
        <i class="pi pi-box" /> Model Configurations
        <Button
          label="Add Model"
          icon="pi pi-plus"
          text
          size="small"
          @click="addModel"
          style="margin-left: auto"
        />
      </template>
      <template #subtitle>
        Make sure to configure API keys above for providers you want to use
      </template>
      <template #content>
        <div class="models-list">
          <div v-for="(model, index) in modelDefinitions" :key="index" class="model-row">
            <InputText
              :value="model.id"
              disabled
              placeholder="Auto-generated ID"
              class="model-id"
            />
            <Dropdown
              v-model="model.provider"
              :options="llmProviders"
              optionLabel="label"
              optionValue="value"
              placeholder="Select provider"
              class="provider-dropdown"
              @change="updateModelId(model)"
            />
            <InputText
              v-model="model.name"
              placeholder="Model name"
              class="model-name"
              @input="updateModelId(model)"
            />
            <Button
              icon="pi pi-trash"
              text
              severity="danger"
              @click="confirmDeleteModel(model.id)"
              class="delete-btn"
            />
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<style scoped>
/* Import shared state styles */
@import '@/styles/states.css';

.status-messages {
  margin-bottom: 1rem;
}

.config-card {
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
  margin-bottom: 1.5rem;
}

:deep(.p-card-title) {
  color: var(--p-primary-color);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
}

:deep(.p-card-subtitle) {
  color: var(--p-text-muted-color);
  font-size: 0.875rem;
}

.api-keys-table {
  width: 100%;
  vertical-align: middle;
}

.api-keys-table .label-cell {
  padding-right: 1rem;
  font-size: 0.875rem;
}

.api-keys-table input {
  width: 32rem;
}

.placeholder-content {
  text-align: center;
  padding: 2rem;
  color: var(--p-text-muted-color);
}

.sub-text {
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

/* LLM Configuration Styles */
.mappings-list,
.models-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.mapping-row,
.model-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.agent-input {
  flex: 1;
  min-width: 150px;
}

.model-dropdown,
.provider-dropdown {
  flex: 1.5;
  min-width: 200px;
}

.model-id {
  flex: 1.5;
  opacity: 0.7;
}

.model-name {
  flex: 2;
  min-width: 200px;
}

.delete-btn {
  flex-shrink: 0;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .mapping-row,
  .model-row {
    flex-wrap: wrap;
  }

  .agent-input,
  .model-dropdown,
  .provider-dropdown,
  .model-id,
  .model-name {
    flex: 1 1 100%;
    min-width: 100%;
  }
}
</style>