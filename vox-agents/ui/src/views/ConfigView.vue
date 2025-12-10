<script setup lang="ts">
import Card from 'primevue/card';
import Button from 'primevue/button';
</script>

<template>
  <div class="config-view">
    <h1>Configuration Management</h1>

    <Card class="config-card">
      <template #title>
        <i class="pi pi-file-edit" /> Configuration Editor
      </template>
      <template #content>
        <div class="placeholder-content">
          <p>Configuration management will be implemented in Phase 6</p>
          <p class="sub-text">Create, edit, and manage JSON configuration files</p>

          <div class="button-group">
            <Button
              label="New Config"
              icon="pi pi-plus"
              severity="success"
              disabled
            />
            <Button
              label="Load Config"
              icon="pi pi-upload"
              disabled
            />
            <Button
              label="Save Config"
              icon="pi pi-save"
              disabled
            />
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.config-view {
  max-width: 1200px;
  margin: 0 auto;
}

h1 {
  color: var(--civ-gold);
  margin-bottom: 2rem;
}

.config-card {
  background: var(--civ-panel);
  border: 1px solid var(--civ-border);
}

:deep(.p-card-title) {
  color: var(--civ-gold);
  display: flex;
  align-items: center;
  gap: 0.5rem;
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

.button-group {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 2rem;
}
</style>