<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import Card from 'primevue/card';
import Button from 'primevue/button';
import FileUpload from 'primevue/fileupload';
import Tag from 'primevue/tag';
import ProgressSpinner from 'primevue/progressspinner';
import ActiveSessionsList from '@/components/ActiveSessionsList.vue';
import { api } from '@/api/client';
import { activeSessions, databases, loading, fetchTelemetryData } from '@/stores/telemetry';
import type { TelemetryMetadata } from '../utils/types';
import { formatFileSize, formatISODate } from '@/api/telemetry-utils';

const router = useRouter();
const uploadProgress = ref(false);
const fileUploadRef = ref<any>(null);

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
      <ActiveSessionsList
        :sessions="activeSessions"
        @session-selected="viewActiveSession"
        @view-session="viewActiveSession" />

      <!-- Existing Databases Section -->
      <Card class="databases-section">
        <template #title>
          <div class="section-header">
            <h3>Past Games</h3>
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
              <div class="col-fixed-200">Folder</div>
              <div class="col-expand">Game ID</div>
              <div class="col-fixed-80">Player</div>
              <div class="col-fixed-80">Size</div>
              <div class="col-fixed-200">Last Modified</div>
              <div class="col-fixed-100">Actions</div>
            </div>

            <!-- Table Body -->
            <div class="table-body">
              <div v-for="db in databases" :key="`${db.folder}/${db.filename}`"
                   class="table-row clickable"
                   @click="viewDatabase(db)">
                <div class="col-fixed-200">
                  <Tag :value="db.folder" severity="secondary" />
                </div>
                <div class="col-expand">
                  {{ db.gameId }}
                </div>
                <div class="col-fixed-80">
                  {{ db.playerId }}
                </div>
                <div class="col-fixed-80">
                  {{ formatFileSize(db.size) }}
                </div>
                <div class="col-fixed-200">
                  {{ formatISODate(db.lastModified) }}
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
@import '@/styles/states.css';

/* Telemetry-specific styles only */
.upload-area {
  padding: 1rem;
}
</style>