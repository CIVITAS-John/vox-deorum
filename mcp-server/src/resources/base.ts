/**
 * Abstract base class for all MCP resources
 * Provides self-registration, lifecycle hooks, and common resource functionality
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { logger } from '../utils/logger.js';

/**
 * Resource metadata interface
 */
export interface ResourceMetadata {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/**
 * Player context for resource operations
 */
export interface PlayerContext {
  playerId?: number;
  [key: string]: any;
}

/**
 * Abstract base class for MCP resources
 */
export abstract class ResourceBase {
  protected metadata: ResourceMetadata;
  protected server?: Server;

  /**
   * Constructor for ResourceBase
   * @param metadata Resource metadata including URI, name, and description
   */
  constructor(metadata: ResourceMetadata) {
    this.metadata = {
      ...metadata,
      mimeType: metadata.mimeType || 'application/json',
    };
  }

  /**
   * Get resource metadata
   */
  public getMetadata(): ResourceMetadata {
    return this.metadata;
  }

  /**
   * Register the resource with the server
   * @param server The MCP server instance
   */
  public register(server: Server): void {
    this.server = server;
    this.onRegistered();
    logger.debug(`Resource ${this.metadata.uri} registered`);
  }

  /**
   * Lifecycle hook called when resource is registered
   * Override in subclasses for custom registration logic
   */
  protected onRegistered(): void {
    // Override in subclasses if needed
  }

  /**
   * Read the resource content
   * Must be implemented by subclasses
   * @param context Optional player context for the read operation
   */
  public abstract read(context?: PlayerContext): Promise<any>;

  /**
   * Lifecycle hook called before reading resource
   * Override for custom pre-read logic
   * @param context Optional player context
   */
  protected async onRead(_context?: PlayerContext): Promise<void> {
    // Override in subclasses if needed
  }

  /**
   * Lifecycle hook called when resource is subscribed to
   * Override for custom subscription logic
   * @param context Optional player context
   */
  protected async onSubscribed(_context?: PlayerContext): Promise<void> {
    // Override in subclasses if needed
  }

  /**
   * Validate resource data
   * Override for custom validation logic
   * @param data Data to validate
   */
  protected validate(_data: any): boolean {
    return true;
  }

  /**
   * Handle errors with consistent logging
   * @param error The error that occurred
   * @param operation The operation that failed
   */
  protected handleError(error: Error, operation: string): void {
    logger.error(`Resource ${this.metadata.uri} error during ${operation}:`, error);
    throw error;
  }

  /**
   * Update resource metadata
   * @param updates Partial metadata updates
   */
  protected updateMetadata(updates: Partial<ResourceMetadata>): void {
    this.metadata = {
      ...this.metadata,
      ...updates,
    };
    logger.debug(`Resource ${this.metadata.uri} metadata updated`);
  }

  /**
   * Check if resource supports player-specific context
   */
  public supportsPlayerContext(): boolean {
    return false; // Override in subclasses that support player context
  }

  /**
   * Get resource URI
   */
  public getUri(): string {
    return this.metadata.uri;
  }

  /**
   * Get resource name
   */
  public getName(): string {
    return this.metadata.name;
  }

  /**
   * Get resource description
   */
  public getDescription(): string | undefined {
    return this.metadata.description;
  }

  /**
   * Get resource MIME type
   */
  public getMimeType(): string {
    return this.metadata.mimeType || 'application/json';
  }
}