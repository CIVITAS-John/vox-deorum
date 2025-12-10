<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Button from 'primevue/button'
import { RouterView } from 'vue-router'

const router = useRouter()
const route = useRoute()

// Navigation menu items
const menuItems = ref([
  { label: 'Dashboard', icon: 'pi pi-home', route: '/' },
  { label: 'Telemetry', icon: 'pi pi-chart-line', route: '/telemetry' },
  { label: 'Logs', icon: 'pi pi-list', route: '/logs' },
  { label: 'Session', icon: 'pi pi-play', route: '/session' },
  { label: 'Config', icon: 'pi pi-cog', route: '/config' },
  { label: 'Chat', icon: 'pi pi-comments', route: '/chat' }
])

// Sidebar collapse state
const sidebarCollapsed = ref(false)

const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

const navigateTo = (path: string) => {
  router.push(path)
}

const isActive = (path: string) => {
  return route.path === path
}
</script>

<template>
  <div class="app-container">
    <!-- Sidebar -->
    <aside class="sidebar" :class="{ collapsed: sidebarCollapsed }">
      <div class="sidebar-header">
        <h1 class="app-title" v-if="!sidebarCollapsed">Vox Deorum</h1>
        <Button
          icon="pi pi-bars"
          @click="toggleSidebar"
          class="toggle-btn"
          text
          severity="secondary"
        />
      </div>

      <nav class="sidebar-nav">
        <div
          v-for="item in menuItems"
          :key="item.route"
          class="nav-item"
          :class="{ active: isActive(item.route) }"
          @click="navigateTo(item.route)"
        >
          <i :class="item.icon" class="nav-icon"></i>
          <span class="nav-label" v-if="!sidebarCollapsed">{{ item.label }}</span>
        </div>
      </nav>

      <div class="sidebar-footer">
        <div class="status-indicator">
          <i class="pi pi-circle-fill status-icon"></i>
          <span v-if="!sidebarCollapsed" class="status-text">Ready</span>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <RouterView />
    </main>
  </div>
</template>

<style>
/* Civ5-inspired theme variables */
:root {
  --civ-gold: #D4AF37;
  --civ-bronze: #8B6914;
  --civ-dark: #1A2332;
  --civ-panel: #2C3E50;
  --civ-hover: #34495E;
  --civ-text: #F5E6D3;
  --civ-muted: #7F8C8D;
  --civ-success: #27AE60;
  --civ-error: #C0392B;
  --civ-border: #3a4a5c;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background-color: var(--civ-dark);
  color: var(--civ-text);
}

.app-container {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

/* Sidebar Styles */
.sidebar {
  width: 250px;
  background: linear-gradient(135deg, var(--civ-panel) 0%, #253340 100%);
  border-right: 2px solid var(--civ-gold);
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.3);
}

.sidebar.collapsed {
  width: 60px;
}

.sidebar-header {
  padding: 1.5rem 1rem;
  border-bottom: 1px solid var(--civ-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.app-title {
  font-size: 1.5rem;
  color: var(--civ-gold);
  font-weight: 600;
  white-space: nowrap;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
}

.toggle-btn {
  color: var(--civ-text) !important;
}

.sidebar-nav {
  flex: 1;
  padding: 1rem 0;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.nav-item:hover {
  background-color: var(--civ-hover);
}

.nav-item.active {
  background-color: var(--civ-hover);
  border-left: 3px solid var(--civ-gold);
}

.nav-icon {
  font-size: 1.25rem;
  color: var(--civ-text);
  margin-right: 0.75rem;
  min-width: 1.25rem;
}

.sidebar.collapsed .nav-icon {
  margin-right: 0;
}

.nav-label {
  color: var(--civ-text);
  font-size: 0.95rem;
  white-space: nowrap;
}

.sidebar-footer {
  padding: 1rem;
  border-top: 1px solid var(--civ-border);
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-icon {
  color: var(--civ-success);
  font-size: 0.75rem;
}

.status-text {
  font-size: 0.85rem;
  color: var(--civ-muted);
}

/* Main Content */
.main-content {
  flex: 1;
  background-color: var(--civ-dark);
  overflow-y: auto;
  padding: 2rem;
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--civ-panel);
}

::-webkit-scrollbar-thumb {
  background: var(--civ-bronze);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--civ-gold);
}
</style>