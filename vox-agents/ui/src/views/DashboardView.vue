<script setup lang="ts">
import Card from 'primevue/card';
import { healthStatus } from '../stores/health';

const formatUptime = (seconds?: number) => {
  if (!seconds) return 'N/A';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours}h ${minutes}m ${secs}s`;
};
</script>

<template>
  <div class="dashboard">
    <h1>Dashboard</h1>

    <Card class="mb-3">
      <template #title>
        <i class="pi pi-heart-fill" /> System Health
      </template>
      <template #content>
        <div v-if="!healthStatus" class="loading">
          <i class="pi pi-spin pi-spinner" />
        </div>
        <div v-else-if="healthStatus.status === 'error'" class="error">
          <i class="pi pi-exclamation-triangle" />
          Failed to connect to service
        </div>
        <div v-else class="health-info">
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
  </div>
</template>