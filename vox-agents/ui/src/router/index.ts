import { createRouter, createWebHistory } from 'vue-router'
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
      redirect: '/session'
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
      path: '/telemetry/database/:filename+/trace/:traceId',
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
    },
    {
      path: '/chat/:sessionId',
      name: 'chat-detail',
      component: () => import('../views/ChatDetailView.vue')
    }
  ],
})

export default router
