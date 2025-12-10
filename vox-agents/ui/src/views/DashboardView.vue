<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { apiClient, type HealthStatus } from '../api/client';
import Card from 'primevue/card';

const healthStatus = ref<HealthStatus | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

const fetchHealth = async () => {
  try {
    loading.value = true;
    error.value = null;
    healthStatus.value = await apiClient.getHealth();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to fetch health status';
  } finally {
    loading.value = false;
  }
};

const formatUptime = (seconds?: number) => {
  if (!seconds) return 'N/A';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours}h ${minutes}m ${secs}s`;
};

onMounted(() => {
  fetchHealth();
  // Refresh every 5 seconds
  setInterval(fetchHealth, 5000);
});
</script>

<template>
  <div class="dashboard">
    <h1>Dashboard</h1>

    <Card class="mb-3">
      <template #title>
        <i class="pi pi-heart-fill" /> System Health
      </template>
      <template #content>
        <div v-if="loading" class="loading">
          <i class="pi pi-spin pi-spinner" />
        </div>
        <div v-else-if="error" class="error">
          <i class="pi pi-exclamation-triangle" />
          {{ error }}
        </div>
        <div v-else-if="healthStatus" class="health-info">
          <div class="health-item">
            <span class="label">Service: </span>
            <span class="value">{{ healthStatus.service }}</span>
          </div>
          <div class="health-item">
            <span class="label">Version: </span>
            <span class="value">{{ healthStatus.version || 'N/A' }}</span>
          </div>
          <div class="health-item">
            <span class="label">Uptime: </span>
            <span class="value">{{ formatUptime(healthStatus.uptime) }}</span>
          </div>
          <div class="health-item">
            <span class="label">Connected Clients: </span>
            <span class="value">{{ healthStatus.clients || 0 }}</span>
          </div>
        </div>
      </template>
    </Card>

    <Card class="mb-3">
      <template #title>
        <i class="pi pi-chart-line" /> Quick Stats
      </template>
      <template #content>
        <p class="placeholder">Session statistics will appear here</p>
      </template>
    </Card>

    <Card class="mb-3">
      <template #title>
        <i class="pi pi-clock" /> Recent Activity
      </template>
      <template #content>
        <p class="placeholder">Recent activity feed will appear here</p>
      </template>
    </Card>

    <Card class="mb-3">
      <template #title>
        <i class="pi pi-cog" /> Configuration
      </template>
      <template #content>
        <p class="placeholder">Active configuration summary will appear here</p>
      </template>
    </Card>
  </div>
</template>