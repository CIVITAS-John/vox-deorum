<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import Card from 'primevue/card';
import Button from 'primevue/button';
import FileUpload from 'primevue/fileupload';
import Tag from 'primevue/tag';
import ProgressSpinner from 'primevue/progressspinner';
import { api } from '@/api/client';
import { activeSessions, databases, loading, fetchTelemetryData } from '@/stores/telemetry';
import type { TelemetryMetadata } from '@/api/types';

interface ActiveSession {
  contextId: string;
  gameId?: string;
  playerId?: string;
}

const router = useRouter();
const uploadProgress = ref(false);
const fileUploadRef = ref<any>(null);

/**
 * Format file size for display
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Format date for display
 */
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

/**
 * Parse session ID to extract game and player info
 */
function parseSessionId(sessionId: string): ActiveSession {
  // Format is typically: gameId-playerId-timestamp
  const parts = sessionId.split('-');
  if (parts.length >= 2) {
    const playerId = parts[parts.length - 1];
    const gameId = parts.slice(0, -1).join('-');
    return { contextId: sessionId, gameId, playerId };
  }
  return { contextId: sessionId };
}


/**
 * Navigate to active session view
 */
function viewActiveSession(sessionId: string) {
  router.push({ name: 'telemetry-session', params: { sessionId } });
}

/**
 * Navigate to database view
 */
function viewDatabase(db: TelemetryMetadata) {
  // Encode the full path (folder/filename) for the route
  const fullPath = db.folder === 'telemetry' ? db.filename : `${db.folder}/${db.filename}`;
  router.push({
    name: 'telemetry-database',
    params: { filename: fullPath }
  });
}

/**
 * Handle file upload using typed API
 */
async function onUpload(event: any) {
  uploadProgress.value = true;

  try {
    const file = event.files[0];
    if (!file) return;

    const result = await api.uploadDatabase(file);

    if (result.success) {
      // Refresh database list after successful upload
      await fetchTelemetryData();
      // Clear the upload queue
      if (fileUploadRef.value) {
        fileUploadRef.value.clear();
      }
    }
  } catch (error) {
    console.error('Upload error:', error);
  } finally {
    uploadProgress.value = false;
  }
}

onMounted(() => {
  // Initial load of telemetry data
  fetchTelemetryData();
});
</script>

<template>
  <div class="telemetry-view">
    <h1>Telemetry Viewer</h1>

    <div v-if="loading" class="loading-container">
      <ProgressSpinner />
      <p>Loading telemetry data...</p>
    </div>

    <div v-else class="section-container">
      <!-- Active Sessions Section -->
      <Card class="active-sessions-section">
        <template #title>
          <div class="section-header">
            <span>Active Sessions</span>
            <Tag v-if="activeSessions.length > 0" :value="activeSessions.length" severity="success" />
          </div>
        </template>

        <template #content>
          <div v-if="activeSessions.length === 0" class="table-empty">
            <i class="pi pi-info-circle"></i>
            <p>No active telemetry sessions</p>
          </div>

          <div v-else class="data-table">
            <!-- Table Header -->
            <div class="table-header">
              <div class="col-expand">Session ID</div>
              <div class="col-fixed-150">Game</div>
              <div class="col-fixed-100">Player</div>
              <div class="col-fixed-100">Status</div>
              <div class="col-fixed-80">Actions</div>
            </div>

            <!-- Table Body -->
            <div class="table-body">
              <div v-for="sessionId in activeSessions" :key="sessionId"
                   class="table-row clickable"
                   @click="viewActiveSession(sessionId)">
                <div class="col-expand">
                  <span class="monospace">{{ parseSessionId(sessionId).contextId }}</span>
                </div>
                <div class="col-fixed-150">
                  {{ parseSessionId(sessionId).gameId || '-' }}
                </div>
                <div class="col-fixed-100">
                  {{ parseSessionId(sessionId).playerId || '-' }}
                </div>
                <div class="col-fixed-100">
                  <Tag value="Live" severity="success" />
                </div>
                <div class="col-fixed-80">
                  <Button icon="pi pi-eye" text rounded size="small"
                          @click.stop="viewActiveSession(sessionId)" />
                </div>
              </div>
            </div>
          </div>
        </template>
      </Card>

      <!-- Existing Databases Section -->
      <Card class="databases-section">
        <template #title>
          <div class="section-header">
            <span>Existing Databases</span>
            <Tag v-if="databases.length > 0" :value="databases.length" />
          </div>
        </template>

        <template #header>
          <div class="upload-area">
            <FileUpload
              ref="fileUploadRef"
              mode="basic"
              name="database"
              accept=".db"
              :maxFileSize="104857600"
              :auto="true"
              customUpload
              @uploader="onUpload"
              chooseLabel="Upload Database"
              :chooseIcon="uploadProgress ? 'pi pi-spin pi-spinner' : 'pi pi-upload'"
              :disabled="uploadProgress"
            />
          </div>
        </template>

        <template #content>
          <div v-if="databases.length === 0" class="table-empty">
            <i class="pi pi-database"></i>
            <p>No telemetry databases found</p>
            <p class="text-small text-muted">Upload a database file or wait for active sessions to complete</p>
          </div>

          <div v-else class="data-table">
            <!-- Table Header -->
            <div class="table-header">
              <div class="col-expand">Filename</div>
              <div class="col-fixed-150">Folder</div>
              <div class="col-fixed-250">Game ID</div>
              <div class="col-fixed-100">Player</div>
              <div class="col-fixed-80">Size</div>
              <div class="col-fixed-150">Last Modified</div>
              <div class="col-fixed-100">Actions</div>
            </div>

            <!-- Table Body -->
            <div class="table-body">
              <div v-for="db in databases" :key="`${db.folder}/${db.filename}`"
                   class="table-row clickable"
                   @click="viewDatabase(db)">
                <div class="col-expand">
                  <span class="monospace">{{ db.filename }}</span>
                </div>
                <div class="col-fixed-150">
                  <Tag :value="db.folder" severity="secondary" />
                </div>
                <div class="col-fixed-200">
                  {{ db.gameId }}
                </div>
                <div class="col-fixed-100">
                  {{ db.playerId }}
                </div>
                <div class="col-fixed-80">
                  {{ formatSize(db.size) }}
                </div>
                <div class="col-fixed-150">
                  {{ formatDate(db.lastModified) }}
                </div>
                <div class="col-fixed-100">
                  <Button label="View" icon="pi pi-chart-line" text size="small"
                          @click.stop="viewDatabase(db)" />
                </div>
              </div>
            </div>
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>

<style scoped>
@import '@/styles/global.css';
@import '@/styles/data-table.css';

/* Telemetry-specific styles only */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 1rem;
}

.upload-area {
  padding: 1rem;
  border-bottom: 1px solid var(--surface-border);
}
</style>