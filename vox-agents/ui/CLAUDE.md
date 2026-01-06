# CLAUDE.md - Vox Agents UI

Vue 3 + TypeScript UI. Follow existing patterns, don't reinvent.

## Core Principles

### Look Before You Leap
- **Check existing components** in `components/` before creating new ones
- **Review existing styles** in `styles/` (global, panel, states, data-table, civ5-theme)
- **Use existing stores** in `stores/` for state management patterns
- **Import types** from `@/utils/types` which re-exports backend types

### Type Safety
```typescript
// All types come from one place
import type { VoxContext, ToolCall, AIMessage } from '@/utils/types';

// Never use any or unknown
// Always use defineProps<T>() and defineEmits<T>()
```

### PrimeVue First
- Use PrimeVue components and PrimeFlex utilities
- Check [PrimeVue docs](https://primevue.org) before custom solutions
- Prefer component props over custom CSS
- Use theme CSS variables for consistency
- **Design tokens**: Use `--p-content-*` for data displays (tables, panels), avoid `--p-surface-*` for UI elements
- **Spacing**: Avoid excessive padding/margins - prefer compact layouts using existing stylesheet spacing

### State Patterns
- **Stores**: Reactive refs exported directly (see `stores/health.ts`)
- **SSE**: Auto-reconnect with exponential backoff (see `stores/logs.ts`)
- **API**: Centralized client with typed responses (see `api/client.ts`)

## Component Patterns

### Loading/Error/Empty States
```vue
<!-- Use existing CSS classes from styles/states.css -->
<div v-if="loading" class="loading-container">
  <i class="pi pi-spin pi-spinner" style="font-size: 2rem;" />
  <p>Loading...</p>
</div>

<div v-else-if="error" class="error-container">
  <i class="pi pi-exclamation-triangle" />
  <p>{{ error }}</p>
</div>

<div v-else-if="!data.length" class="empty-state">
  <i class="pi pi-inbox" />
  <p>No data available</p>
</div>
```

### Polling & Real-Time Data
```vue
<script setup>
// Poll data while dialog is visible
const dialogVisible = ref(false);
let pollInterval = null;

watch(dialogVisible, (visible) => {
  if (visible) {
    loadData();
    pollInterval = setInterval(loadData, 60000); // 60s
  } else {
    if (pollInterval) clearInterval(pollInterval);
  }
});

// Always cleanup on unmount
onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval);
});
</script>
```

### Real Examples to Follow
- **LogViewer.vue** - SSE streaming, filtering, virtual scroll
- **DashboardView.vue** - Cards, health monitoring, state patterns
- **TelemetryView.vue** - DataTable with pagination, trace navigation
- **ConfigView.vue** - Forms, validation, JSON editing
- **AIMessagesViewer.vue** - Message rendering, tool calls display

## File Structure
```
src/
├── api/          # API client, SSE utils
├── components/   # Reusable Vue components
├── stores/       # Reactive state management
├── styles/       # Global CSS, theme overrides
├── utils/        # Type definitions, helpers
└── views/        # Route-level components
```

## Performance Guidelines
- Virtual scroll for lists > 100 items
- Debounce search inputs (300ms)
- Buffer limits: 1000 logs, 100 telemetry spans
- Lazy load routes with `() => import()`

## Integration
- Backend types via `@/utils/types`
- Winston logs via SSE (`stores/logs.ts`)
- Config from `config.json` via API
- Telemetry SQLite via Kysely

## Data Display Patterns

### Backend/Frontend Separation
- **Backend**: Send complete data structures without pre-formatting
- **Frontend**: Handle formatting, filtering, sorting for display
- Example: Backend returns full `PlayersReport`, frontend filters to major players and formats values

## Commands
```bash
cd vox-agents/ui
npm run dev           # Dev server with HMR
npm run build         # Production build to ../dist-ui/

cd vox-agents
npm run webui:dev     # Backend + frontend together
```

## Don'ts
- Don't use `any` or `unknown` types
- Don't create styles when PrimeFlex has it
- Don't poll when SSE is available
- Don't hardcode URLs or magic numbers
- Don't skip error handling
- Don't mutate props, use emits
- Don't fetch in templates

## When Adding Features
1. Check PrimeVue catalog first
2. Look at existing components for patterns (especially similar ones)
3. Use types from `@/utils/types`
4. Use existing CSS classes from `styles/` - minimize component-specific styles
5. Sort data by stable identifiers (IDs) for predictable ordering
6. Backend sends full data, frontend formats and filters for display
7. Handle loading, error, and empty states
8. Test with real game data