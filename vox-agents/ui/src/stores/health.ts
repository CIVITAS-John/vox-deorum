import { ref } from 'vue';
import { apiClient, type HealthStatus } from '../api/client';

export const healthStatus = ref<HealthStatus | null>(null);

const fetchHealth = async () => {
  try {
    healthStatus.value = await apiClient.getHealth();
  } catch (err) {
    // On error, set a disconnected status
    healthStatus.value = {
      status: 'error',
      timestamp: new Date().toISOString(),
      service: 'vox-agents',
      version: 'Unknown'
    };
  }
};

// Start fetching immediately and every 5 seconds
fetchHealth();
setInterval(fetchHealth, 5000);