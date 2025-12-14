/**
 * Utility functions for telemetry data formatting and processing
 */

import type { Span } from '../utils/types';

/**
 * Format duration in milliseconds for display
 */
export function formatDuration(ms: number): string {
  if (ms < 0.001) return `${(ms * 1000000).toFixed(0)}ns`;
  if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(1);
  return `${minutes}m ${seconds}s`;
}

/**
 * Format nanosecond timestamp for display
 */
export function formatTimestamp(nanos: number): string {
  const date = new Date(nanos / 1000000); // Convert nanoseconds to milliseconds
  return date.toLocaleTimeString([], {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Format date from nanosecond timestamp
 */
export function formatDate(nanos: number): string {
  const date = new Date(nanos / 1000000);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

/**
 * Format ISO date string for display
 */
export function formatISODate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

/**
 * Get status severity for PrimeVue Tag component
 * Based on OpenTelemetry StatusCode enum:
 * 0 = UNSET, 1 = OK, 2 = ERROR
 */
export function getStatusSeverity(statusCode: number): 'success' | 'danger' | 'warning' {
  switch (statusCode) {
    case 1: // OK
      return 'success';
    case 2: // ERROR
      return 'danger';
    default: // UNSET (0) or unknown
      return 'warning';
  }
}

/**
 * Get status text label
 * Based on OpenTelemetry StatusCode enum:
 * 0 = UNSET, 1 = OK, 2 = ERROR
 */
export function getStatusText(statusCode: number): string {
  switch (statusCode) {
    case 0:
      return 'UNSET';
    case 1:
      return 'OK';
    case 2:
      return 'ERROR';
    default:
      return 'UNKNOWN';
  }
}

/**
 * Get status emoji for inline display
 * Based on OpenTelemetry StatusCode enum:
 * 0 = UNSET, 1 = OK, 2 = ERROR
 */
export function getStatusEmoji(statusCode: number): string {
  switch (statusCode) {
    case 1: // OK
      return '✅';
    case 2: // ERROR
      return '❌';
    default: // UNSET (0) or unknown
      return '⚪';
  }
}

/**
 * Format file size in bytes for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

/**
 * Get service name from span attributes
 */
export function getServiceName(span: Span): string {
  return span.attributes?.service_name || span.attributes?.['service.name'] || 'unknown';
}

/**
 * Extract key attributes for display (limited list)
 */
export function getDisplayAttributes(span: Span, maxAttrs: number = 4): Array<{key: string, value: string}> {
  const attrs: Array<{key: string, value: string}> = [];

  // Priority attributes to show
  const priorityKeys = [
    'service_name',
    'service.name',
    'agent_name',
    'operation',
    'phase',
    'player_id',
    'turn',
    'http.method',
    'http.url',
    'db.statement'
  ];

  // Add service name first if exists
  const serviceName = getServiceName(span);
  if (serviceName !== 'unknown') {
    attrs.push({ key: 'Service', value: serviceName });
  }

  // Add turn if present
  if (span.turn !== null && span.turn !== undefined) {
    attrs.push({ key: 'Turn', value: span.turn.toString() });
  }

  // Add other priority attributes
  for (const key of priorityKeys) {
    if (attrs.length >= maxAttrs) break;

    if (span.attributes?.[key] && !['service_name', 'service.name'].includes(key)) {
      const displayKey = key
        .replace(/_/g, ' ')
        .replace(/\./g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
      const value = String(span.attributes[key]);

      // Skip if we already have this value
      if (!attrs.some(a => a.value === value)) {
        attrs.push({ key: displayKey, value });
      }
    }
  }

  return attrs.slice(0, maxAttrs);
}

/**
 * Build span hierarchy tree structure
 */
export interface SpanNode extends Span {
  children: SpanNode[];
  depth: number;
}

export function buildSpanTree(spans: Span[]): SpanNode[] {
  if (spans.length === 0) return [];

  // Create a map for quick lookup
  const spanMap = new Map<string, SpanNode>();
  const roots: SpanNode[] = [];

  // First pass: create all nodes
  spans.forEach(span => {
    spanMap.set(span.spanId, {
      ...span,
      children: [],
      depth: 0
    });
  });

  // Second pass: build hierarchy
  spans.forEach(span => {
    const node = spanMap.get(span.spanId)!;

    if (span.parentSpanId && spanMap.has(span.parentSpanId)) {
      const parent = spanMap.get(span.parentSpanId)!;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // Third pass: calculate depths recursively
  const calculateDepth = (node: SpanNode, depth: number = 0) => {
    node.depth = depth;
    node.children.forEach(child => calculateDepth(child, depth + 1));
  };

  roots.forEach(root => calculateDepth(root, 0));

  // Sort children by start time
  const sortChildren = (node: SpanNode) => {
    node.children.sort((a, b) => a.startTime - b.startTime);
    node.children.forEach(sortChildren);
  };

  roots.forEach(sortChildren);
  roots.sort((a, b) => a.startTime - b.startTime);

  return roots;
}

/**
 * Flatten span tree for display with expansion state
 */
export function flattenSpanTree(roots: SpanNode[], expandedSpans: Set<string>): SpanNode[] {
  const result: SpanNode[] = [];

  const flatten = (node: SpanNode) => {
    result.push(node);
    if (expandedSpans.has(node.spanId)) {
      node.children.forEach(flatten);
    }
  };

  roots.forEach(flatten);
  return result;
}

/**
 * Format span for console-style display
 */
export function formatSpanLine(span: Span): string {
  const time = formatTimestamp(span.startTime);
  const service = getServiceName(span);
  const duration = formatDuration(span.durationMs);
  const status = getStatusEmoji(span.statusCode);

  return `[${time}] [${service}] ${span.name} (${duration}) ${status}`;
}

/**
 * Get CSS class for span row styling
 */
export function getSpanRowClass(span: Span): string {
  const classes = ['span-row'];

  // OpenTelemetry StatusCode: 0 = UNSET, 1 = OK, 2 = ERROR
  if (span.statusCode === 2) {
    classes.push('span-error');
  }

  if (span.parentSpanId) {
    classes.push('span-child');
  }

  return classes.join(' ');
}

/**
 * Format token count with thousands separator
 */
export function formatTokenCount(count: number | undefined): string {
  if (count === undefined || count === null) return '-';
  return count.toLocaleString('en-US');
}