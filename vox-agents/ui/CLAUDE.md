# CLAUDE.md - Vox Agents UI

This file provides guidance for Claude Code when working with the Vue UI components.

## UI Development Patterns

### Component Architecture
- **PrimeVue-first approach** - Always use existing PrimeVue components before creating custom ones
- **Composition API** - Use `<script setup lang="ts">` for all components
- **TypeScript strict mode** - All props, events, and data must be properly typed
- **Single File Components** - Keep template, script, and styles together

### State Management
- **Vue stores** - Use reactive refs in stores for cross-component state (see `stores/health.ts`)
- **Local state** - Use `ref()` and `computed()` for component-specific state
- **Props down, events up** - Follow standard Vue data flow patterns
- **SSE for real-time** - Use Server-Sent Events for streaming data (logs, telemetry)

### API Integration
```typescript
// Always use the centralized API client
import { apiClient } from '@/api/client';

// Type all API responses
interface MyResponse {
  data: string;
  timestamp: string;
}

// Handle errors gracefully
try {
  const result = await apiClient.getCustom<MyResponse>('/api/endpoint');
} catch (error) {
  // Show user-friendly error
}
```

### PrimeVue Component Usage
```vue
<!-- Always import components explicitly -->
<script setup lang="ts">
import Card from 'primevue/card';
import Button from 'primevue/button';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
</script>

<!-- Use PrimeVue's built-in styling classes -->
<template>
  <Card class="mb-3">
    <template #title>
      <i class="pi pi-icon-name" /> Title
    </template>
    <template #content>
      <!-- Content here -->
    </template>
  </Card>
</template>
```

### Styling Guidelines
- **PrimeVue themes** - Use Aura theme as base, customize with CSS variables
- **Utility classes** - Use PrimeFlex for layout (flex, grid, spacing)
- **Scoped styles** - Always use `<style scoped>` to prevent style leakage
- **Dark mode** - Support via CSS class toggle on document root
- **Responsive design** - Use PrimeFlex breakpoint utilities

### Real-time Data Patterns
```typescript
// SSE connection with auto-reconnect
class SSEClient {
  private eventSource: EventSource | null = null;
  private reconnectTimeout: number | null = null;

  connect() {
    this.eventSource = new EventSource('/api/stream');

    this.eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // Handle data
    };

    this.eventSource.onerror = () => {
      this.reconnect();
    };
  }

  private reconnect() {
    // Exponential backoff
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, Math.min(30000, (this.reconnectDelay *= 2)));
  }
}
```

### Performance Optimizations
- **Virtual scrolling** - Use PrimeVue DataTable virtual scroll for large datasets
- **Debounced inputs** - 300ms debounce for search/filter inputs
- **Lazy loading** - Load data on-demand, not all at once
- **Component lazy loading** - Use Vue Router's lazy loading for views
- **Buffer limits** - Cap log buffers at 1000 lines, telemetry at 100 per page

### Error Handling
```typescript
// Standardized error display
const showError = (message: string) => {
  toast.add({
    severity: 'error',
    summary: 'Error',
    detail: message,
    life: 5000
  });
};

// API error handler
const handleApiError = (error: any) => {
  if (error.response?.data?.message) {
    showError(error.response.data.message);
  } else if (error.message) {
    showError(error.message);
  } else {
    showError('An unexpected error occurred');
  }
};
```

### Testing Approach
- **Component testing** - Use Vitest with @vue/test-utils
- **API mocking** - Mock API calls in tests, not in components
- **Real data testing** - Test with actual game data early and often
- **E2E testing** - Manual testing during development phases

## File Organization

### Views
- Each major route gets its own view in `views/`
- Views orchestrate components and handle routing
- Views should be relatively thin, delegating to components

### Components
- Reusable UI elements in `components/`
- Each component should have a single, clear responsibility
- Prefer composition over inheritance

### Stores
- Shared reactive state in `stores/`
- Each store handles one domain (health, session, etc.)
- Export reactive refs directly, not classes

### API
- All HTTP/SSE logic in `api/`
- Centralized error handling
- Type-safe request/response interfaces

## Common Patterns

### Loading States
```vue
<template>
  <div v-if="loading" class="flex align-items-center justify-content-center">
    <i class="pi pi-spin pi-spinner text-4xl" />
  </div>
  <div v-else-if="error" class="text-center">
    <i class="pi pi-exclamation-triangle text-4xl text-orange-500" />
    <p>{{ error }}</p>
  </div>
  <div v-else>
    <!-- Main content -->
  </div>
</template>
```

### Data Tables
```vue
<DataTable
  :value="data"
  :paginator="true"
  :rows="10"
  :rowsPerPageOptions="[10, 25, 50]"
  :loading="loading"
  :virtualScrollerOptions="{ itemSize: 46 }"
  scrollable
  scrollHeight="400px"
>
  <Column field="name" header="Name" :sortable="true" />
  <Column field="value" header="Value">
    <template #body="{ data }">
      <Tag :value="data.value" />
    </template>
  </Column>
</DataTable>
```

### Form Validation
```typescript
// Use reactive forms with validation
const formData = reactive({
  name: '',
  email: ''
});

const errors = reactive({
  name: '',
  email: ''
});

const validate = () => {
  errors.name = formData.name ? '' : 'Name is required';
  errors.email = formData.email.includes('@') ? '' : 'Invalid email';
  return !errors.name && !errors.email;
};
```

## Development Workflow

### Starting Development
```bash
cd vox-agents/ui
npm run dev  # Starts Vite dev server with HMR
```

### Building for Production
```bash
npm run build  # Outputs to ../dist-ui/
```

### Running with Backend
```bash
cd vox-agents
npm run webui:dev  # Runs both backend and frontend
```

## Common Pitfalls to Avoid

1. **Don't fetch in templates** - Always fetch in setup() or onMounted()
2. **Don't mutate props** - Use emit to communicate changes to parent
3. **Don't use any type** - Always provide proper TypeScript types
4. **Don't ignore errors** - Always handle and display errors to users
5. **Don't poll unnecessarily** - Use SSE for real-time updates
6. **Don't create custom components prematurely** - Check PrimeVue catalog first
7. **Don't hardcode API URLs** - Always use the API client
8. **Don't skip loading states** - Users need feedback during async operations

## Integration Points

### With Vox Agents Backend
- Shared process - UI server runs in same Node process
- Unified configuration - Reads from same config.json
- Logger integration - Winston logs streamed via SSE
- Session management - Direct access to StrategistSession

### With Game Data
- Telemetry databases - Direct SQLite access via Kysely
- Agent parameters - Read-only context from VoxContext
- MCP tools - Visualization of tool calls and responses
- Game state - Real-time updates via bridge service (future)

## Next Steps for Development

When implementing new features:
1. Check if PrimeVue has a component for it
2. Create TypeScript interfaces for all data
3. Implement API endpoint if needed
4. Build component with loading/error states
5. Add to router if it's a new view
6. Test with real game data
7. Handle edge cases (empty data, errors, disconnections)