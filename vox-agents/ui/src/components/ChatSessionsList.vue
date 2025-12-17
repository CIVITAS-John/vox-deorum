<script setup lang="ts">
import { computed } from 'vue';
import Card from 'primevue/card';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import type { EnvoyThread } from '@/utils/types';

/**
 * Props for the ChatSessionsList component
 */
interface Props {
  sessions: EnvoyThread[];
  title?: string;
  emptyMessage?: string;
  showActions?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Active Chat Sessions',
  emptyMessage: 'No active chat sessions',
  showActions: true
});

/**
 * Emit events for session actions
 */
const emit = defineEmits<{
  'session-selected': [session: EnvoyThread];
  'session-resume': [sessionId: string];
  'session-delete': [sessionId: string];
}>();

/**
 * Handle session selection
 */
function handleSessionClick(session: EnvoyThread) {
  emit('session-selected', session);
}

/**
 * Handle resume button click
 */
function handleResumeClick(sessionId: string) {
  emit('session-resume', sessionId);
}

/**
 * Handle delete button click
 */
function handleDeleteClick(sessionId: string) {
  emit('session-delete', sessionId);
}

/**
 * Computed property for sessions count
 */
const sessionCount = computed(() => props.sessions.length);

/**
 * Format session title or fallback
 */
function getSessionTitle(session: EnvoyThread): string {
  if (session.title) return session.title;
  return `Chat with ${session.agent} - Game ${session.gameID}`;
}
</script>

<template>
  <Card class="chat-sessions-card">
    <template #title>
      <div class="section-header">
        <h3>{{ title }}</h3>
        <Tag v-if="sessionCount > 0" :value="sessionCount" severity="info" />
      </div>
    </template>

    <template #content>
      <div v-if="sessionCount === 0" class="table-empty">
        <i class="pi pi-comments"></i>
        <p>{{ emptyMessage }}</p>
        <slot name="empty-action"></slot>
      </div>

      <div v-else class="data-table">
        <!-- Table Header -->
        <div class="table-header">
          <div class="col-expand">Session</div>
          <div class="col-fixed-120">Agent</div>
          <div class="col-fixed-250">Game</div>
          <div class="col-fixed-60">Player</div>
          <div v-if="showActions" class="col-fixed-120">Actions</div>
        </div>

        <!-- Table Body -->
        <div class="table-body">
          <div v-for="session in sessions" :key="session.id"
               class="table-row clickable"
               @click="handleSessionClick(session)">
            <div class="col-expand">
              {{ getSessionTitle(session) }}
            </div>
            <div class="col-fixed-120">
              {{ session.agent }}
            </div>
            <div class="col-fixed-250">
              {{ session.gameID }}
            </div>
            <div class="col-fixed-60">
              {{ session.playerID }}
            </div>
            <div v-if="showActions" class="col-fixed-120">
              <Button icon="pi pi-play" text rounded size="small"
                      title="Resume Chat"
                      @click.stop="handleResumeClick(session.id)" />
              <Button icon="pi pi-trash" text rounded size="small"
                      title="Delete Session"
                      severity="danger"
                      @click.stop="handleDeleteClick(session.id)" />
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

.chat-sessions-card {
  width: 100%;
}
</style>