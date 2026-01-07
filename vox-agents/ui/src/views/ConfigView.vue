<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import Card from 'primevue/card';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';
import Dropdown from 'primevue/dropdown';
import Tooltip from 'primevue/tooltip';
import { useConfirm } from 'primevue/useconfirm';
import { apiClient } from '../api/client';
import type { AgentMapping, LLMConfig, VoxAgentsConfig, ToolMiddlewareType, AgentInfo } from '../utils/types';
import { llmProviders, apiKeyFields, toolMiddlewareOptions } from '../utils/types';
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
const modelDefinitions = ref<LLMConfig[]>([]);

// Agent registry state
const agents = ref<AgentInfo[]>([]);

// Initialize confirmation service
const confirm = useConfirm();

// Computed available models for dropdown
const availableModels = computed(() => {
  return modelDefinitions.value.map(m => ({
    label: m.id,
    value: m.id
  }));
});

// Computed agent types from dynamic registry
const agentTypes = computed(() => {
  return agents.value.map(agent => ({
    label: agent.description || agent.name,
    value: agent.name
  }));
});

// Load configuration and agents on mount
onMounted(async () => {
  await Promise.all([loadConfig(), loadAgents()]);
});

// Load agents from server
async function loadAgents() {
  try {
    const data = await apiClient.getAgents();
    agents.value = data.agents;
  } catch (err: any) {
    error.value = err.message || 'Failed to load agents';
    console.error('Error loading agents:', err);
  }
}

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
    // Ensure all model definitions have an options object
    modelDefinitions.value = definitions.map(def => ({
      ...def,
      options: def.options || {}
    }));

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
    agent: agentTypes.value[0]?.value || 'default',
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
    name: '',
    options: {}
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

// Handle toolMiddleware changes
function handleToolMiddlewareChange(model: LLMConfig, value: ToolMiddlewareType | null) {
  if (!model.options) {
    model.options = {};
  }
  if (value) {
    model.options.toolMiddleware = value;
  } else {
    delete model.options.toolMiddleware;
  }
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
        <h1>System Settings</h1>
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
        <i class="pi pi-key" /> LLM API Keys
      </template>
      <template #subtitle>
        You would need them to play with LLMs. API keys are stored locally and never uploaded
      </template>
      <template #content>
        <table class="api-keys-table">
          <tbody>
            <tr v-for="field in apiKeyFields" :key="field.key">
              <td class="label-cell">
                <label :for="field.key">{{ field.label }}</label>
                <a
                  v-if="field.helpLink"
                  :href="field.helpLink"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="help-link"
                  v-tooltip.top="field.helpTooltip"
                >
                  <i class="pi pi-question-circle"></i>
                </a>
                <span
                  v-else-if="field.helpTooltip"
                  class="help-icon"
                  v-tooltip.top="field.helpTooltip"
                >
                  <i class="pi pi-question-circle"></i>
                </span>
              </td>
              <td class="input-cell">
                <Password
                  v-if="field.type === 'password'"
                  :id="field.key"
                  v-model="apiKeys[field.key]"
                  :inputClass="'password-field'"
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
          <div v-for="(mapping, index) in agentMappings" :key="index" class="field-row">
            <Dropdown
              v-model="mapping.agent"
              :options="agentTypes"
              optionLabel="label"
              optionValue="value"
              placeholder="Select agent type"
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
          <div v-for="(model, index) in modelDefinitions" :key="index" class="field-row">
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
            <Dropdown
              :modelValue="model.options?.toolMiddleware ?? 'rescue'"
              :options="toolMiddlewareOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Select middleware"
              class="middleware-dropdown"
              showClear
              @update:modelValue="(value: ToolMiddlewareType | null) => handleToolMiddlewareChange(model, value)"
            >
              <template #option="slotProps">
                <div v-tooltip.top="slotProps.option.tooltip">
                  {{ slotProps.option.label }}
                </div>
              </template>
            </Dropdown>
            <Button
              icon="pi pi-trash"
              text
              severity="danger"
              @click="confirmDeleteModel(model.id!)"
              class="delete-btn"
            />
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<style scoped>
/* Import shared styles */
@import '@/styles/states.css';
@import '@/styles/config.css';

/* Page-specific styles */
.status-messages {
  margin-bottom: 1.5rem;
}

/* API keys table specific styles */
.api-keys-table {
  width: 100%;
  vertical-align: middle;
}

.api-keys-table .label-cell {
  padding-right: 1rem;
  font-size: 0.875rem;
  white-space: nowrap;
}

.api-keys-table .label-cell label {
  margin-right: 0.5rem;
}

.api-keys-table .help-link,
.api-keys-table .help-icon {
  color: var(--text-color-secondary);
  font-size: 0.875rem;
  vertical-align: middle;
  transition: color 0.2s;
}

.api-keys-table .help-link:hover {
  color: var(--primary-color);
}

.api-keys-table .input-cell input,
.api-keys-table .input-cell :deep(.p-password input),
.api-keys-table .input-cell :deep(.p-inputtext) {
  width: 28rem !important;
}
</style>