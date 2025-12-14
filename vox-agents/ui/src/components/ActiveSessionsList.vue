<script setup lang="ts">
import { computed } from 'vue';
import Card from 'primevue/card';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import type { TelemetrySession } from '@/utils/types';

/**
 * Props for the ActiveSessionsList component
 */
interface Props {
  sessions: TelemetrySession[];
  title?: string;
  emptyMessage?: string;
  showViewButton?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Active Games',
  emptyMessage: 'No active game sessions available',
  showViewButton: true
});

/**
 * Emit events for session selection
 */
const emit = defineEmits<{
  'session-selected': [sessionId: string];
  'view-session': [sessionId: string];
}>();

/**
 * Handle session selection
 */
function handleSessionClick(sessionId: string) {
  emit('session-selected', sessionId);
}

/**
 * Handle view button click
 */
function handleViewClick(sessionId: string) {
  emit('view-session', sessionId);
}

/**
 * Computed property for sessions count
 */
const sessionCount = computed(() => props.sessions.length);
</script>

<template>
  <Card class="active-sessions-card">
    <template #title>
      <div class="section-header">
        <h3>{{ title }}</h3>
        <Tag v-if="sessionCount > 0" :value="sessionCount" severity="success" />
      </div>
    </template>

    <template #content>
      <div v-if="sessionCount === 0" class="table-empty">
        <i class="pi pi-info-circle"></i>
        <p>{{ emptyMessage }}</p>
        <slot name="empty-action"></slot>
      </div>

      <div v-else class="data-table">
        <!-- Table Header -->
        <div class="table-header">
          <div class="col-expand">Game ID</div>
          <div class="col-fixed-80">Player</div>
          <div v-if="showViewButton" class="col-fixed-80">Actions</div>
        </div>

        <!-- Table Body -->
        <div class="table-body">
          <div v-for="session in sessions" :key="session.sessionId"
               class="table-row clickable"
               @click="handleSessionClick(session.sessionId)">
            <div class="col-expand">
              {{ session.gameId || '-' }}
            </div>
            <div class="col-fixed-80">
              {{ session.playerId || '-' }}
            </div>
            <div v-if="showViewButton" class="col-fixed-80">
              <Button icon="pi pi-eye" text rounded size="small"
                      @click.stop="handleViewClick(session.sessionId)" />
            </div>
          </div>
        </div>
      </div>
    </template>
  </Card>
</template>

<style scoped>
@import '@/styles/data-table.css';
@import '@/styles/states.css';

.active-sessions-card {
  width: 100%;
}
</style>