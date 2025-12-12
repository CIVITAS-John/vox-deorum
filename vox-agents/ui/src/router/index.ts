import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'
import TelemetryView from '../views/TelemetryView.vue'
import LogsView from '../views/LogsView.vue'
import SessionView from '../views/SessionView.vue'
import ConfigView from '../views/ConfigView.vue'
import ChatView from '../views/ChatView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: DashboardView
    },
    {
      path: '/telemetry',
      name: 'telemetry',
      component: TelemetryView
    },
    {
      path: '/telemetry/session/:sessionId',
      name: 'telemetry-session',
      component: () => import('../views/TelemetrySessionView.vue')
    },
    {
      path: '/telemetry/database/:filename+',
      name: 'telemetry-database',
      component: () => import('../views/TelemetryDatabaseView.vue')
    },
    {
      path: '/telemetry/trace/:filename+/:traceId',
      name: 'telemetry-trace',
      component: () => import('../views/TelemetryTraceView.vue')
    },
    {
      path: '/logs',
      name: 'logs',
      component: LogsView
    },
    {
      path: '/session',
      name: 'session',
      component: SessionView
    },
    {
      path: '/config',
      name: 'config',
      component: ConfigView
    },
    {
      path: '/chat',
      name: 'chat',
      component: ChatView
    }
  ],
})

export default router
