<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Card from 'primevue/card';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';
import Toolbar from 'primevue/toolbar';
import { apiClient } from '../api/client';

// State
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const success = ref(false);
const apiKeys = ref<Record<string, string>>({});
const config = ref<any>({});

// Predefined API key fields for common LLM providers
const apiKeyFields = [
  { key: 'OPENROUTER_API_KEY', label: 'OpenRouter API Key', type: 'password' },
  { key: 'OPENAI_API_KEY', label: 'OpenAI API Key', type: 'password' },
  { key: 'GOOGLE_AI_API_KEY', label: 'Google AI API Key', type: 'password' },
  { key: 'ANTHROPIC_API_KEY', label: 'Anthropic API Key', type: 'password' },
  { key: 'OLLAMA_URL', label: 'Ollama URL', type: 'text', placeholder: 'http://localhost:11434' }
];

// Load configuration on mount
onMounted(async () => {
  await loadConfig();
});

// Load configuration from server
async function loadConfig() {
  loading.value = true;
  error.value = null;

  try {
    const response = await apiClient.get('/api/config');
    const data = response.data;

    // Initialize API keys with empty strings for missing keys
    const loadedKeys: Record<string, string> = {};
    for (const field of apiKeyFields) {
      loadedKeys[field.key] = data.apiKeys[field.key] || '';
    }
    apiKeys.value = loadedKeys;

    config.value = data.config;
  } catch (err: any) {
    error.value = err.message || 'Failed to load configuration';
    console.error('Error loading config:', err);
  } finally {
    loading.value = false;
  }
}

// Save configuration (API keys and config)
async function saveConfig() {
  saving.value = true;
  error.value = null;
  success.value = false;

  try {
    // Filter out empty API key values
    const nonEmptyKeys = Object.fromEntries(
      Object.entries(apiKeys.value).filter(([_, value]) => value !== '')
    );

    await apiClient.post('/api/config', {
      apiKeys: nonEmptyKeys,
      config: config.value
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
    <h1>Configuration Management</h1>

    <!-- Toolbar with Actions and Messages -->
    <Toolbar class="mb-3">
      <template #start>
        <!-- Loading Spinner Icon -->
        <ProgressSpinner v-if="loading" style="width: 24px; height: 24px" class="mr-2" />
        <!-- Success Message -->
        <Message v-else-if="success" severity="success" :closable="false" class="m-0">
          Saved successfully
        </Message>
        <!-- Error Message -->
        <Message v-else-if="error" severity="error" :closable="true" @close="error = null" class="m-0">
          {{ error }}
        </Message>
      </template>
      <template #end>
        <Button
          label="Reload"
          icon="pi pi-refresh"
          text
          @click="loadConfig"
          :disabled="loading || saving"
          class="mr-2"
        />
        <Button
          label="Save All"
          icon="pi pi-save"
          severity="success"
          @click="saveConfig"
          :loading="saving"
          :disabled="loading"
        />
      </template>
    </Toolbar>

    <!-- Main Content -->
    <!-- LLM API Keys Section -->
    <Card class="config-card">
      <template #title>
        <i class="pi pi-key" /> LLM API Keys
      </template>
      <template #subtitle>
        Configure API keys for Large Language Model providers
      </template>
      <template #content>
        <div class="api-keys-form">
          <div v-for="field in apiKeyFields" :key="field.key" class="field">
            <label :for="field.key">{{ field.label }}</label>
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
          </div>

          <div class="info-message">
            <i class="pi pi-info-circle" />
            <span>API keys are stored locally in your .env file. Saving will replace all existing keys.</span>
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<style scoped>
/* Import shared state styles */
@import '@/styles/states.css';


.config-card {
  background: var(--civ-panel);
  border: 1px solid var(--civ-border);
  margin-bottom: 1.5rem;
}

:deep(.p-card-title) {
  color: var(--civ-gold);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

:deep(.p-card-subtitle) {
  color: var(--civ-muted);
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

.api-keys-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field label {
  font-weight: 500;
  color: var(--civ-text);
  font-size: 0.875rem;
}

.info-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 0.375rem;
  color: var(--civ-text);
  font-size: 0.875rem;
}

.info-message i {
  color: #3b82f6;
}

.placeholder-content {
  text-align: center;
  padding: 2rem;
  color: var(--civ-muted);
}

.sub-text {
  font-size: 0.875rem;
  margin-top: 0.5rem;
}
</style>