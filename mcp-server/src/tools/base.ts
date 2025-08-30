/**
 * Abstract base class for all MCP tools
 * Provides self-registration, lifecycle hooks, schema validation, and common tool functionality
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { logger } from '../utils/logger.js';

/**
 * Tool metadata interface
 */
export interface ToolMetadata {
  name: string;
  description?: string;
  inputSchema: any;
}

/**
 * Player context for tool execution
 */
export interface PlayerContext {
  playerId?: number;
  [key: string]: any;
}

/**
 * Tool execution result
 */
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Abstract base class for MCP tools
 */
export abstract class ToolBase<TInput = any> {
  protected metadata: ToolMetadata;
  protected server?: Server;
  protected zodSchema?: z.ZodSchema<TInput>;

  /**
   * Constructor for ToolBase
   * @param name Tool name
   * @param description Tool description
   * @param zodSchema Optional Zod schema for input validation
   */
  constructor(name: string, description?: string, zodSchema?: z.ZodSchema<TInput>) {
    this.zodSchema = zodSchema;
    this.metadata = {
      name,
      description,
      inputSchema: zodSchema ? this.zodToJsonSchema(zodSchema) : {},
    };
  }

  /**
   * Convert Zod schema to JSON schema
   * @param schema Zod schema to convert
   */
  protected zodToJsonSchema(schema: z.ZodSchema): any {
    const jsonSchema = zodToJsonSchema(schema, { 
      errorMessages: true,
      $refStrategy: 'none'
    });
    
    // Remove the $schema property that's not needed for MCP
    if (jsonSchema && typeof jsonSchema === 'object' && '$schema' in jsonSchema) {
      const { $schema, ...rest } = jsonSchema as any;
      return rest;
    }
    
    return jsonSchema;
  }

  /**
   * Get tool metadata
   */
  public getMetadata(): ToolMetadata {
    return this.metadata;
  }

  /**
   * Register the tool with the server
   * @param server The MCP server instance
   */
  public register(server: Server): void {
    this.server = server;
    this.onRegistered();
    logger.debug(`Tool ${this.metadata.name} registered`);
  }

  /**
   * Lifecycle hook called when tool is registered
   * Override in subclasses for custom registration logic
   */
  protected onRegistered(): void {
    // Override in subclasses if needed
  }

  /**
   * Run the tool with input validation
   * @param input Tool input arguments
   * @param context Optional player context
   */
  public async run(input: any, context?: PlayerContext): Promise<any> {
    try {
      // Validate input if schema is provided
      let validatedInput = input;
      if (this.zodSchema) {
        const result = this.zodSchema.safeParse(input);
        if (!result.success) {
          const errors = result.error.errors
            .map(e => `${e.path.join('.')}: ${e.message}`)
            .join(', ');
          throw new Error(`Validation failed: ${errors}`);
        }
        validatedInput = result.data;
      }

      // Call lifecycle hook
      await this.onExecute(validatedInput, context);

      // Execute the tool
      const result = await this.execute(validatedInput as TInput, context);
      
      return result;
    } catch (error) {
      this.handleError(error as Error, 'execution');
    }
  }

  /**
   * Execute the tool logic
   * Must be implemented by subclasses
   * @param input Validated tool input
   * @param context Optional player context
   */
  protected abstract execute(input: TInput, context?: PlayerContext): Promise<any>;

  /**
   * Get the input schema for the tool
   * Can be overridden in subclasses for dynamic schemas
   */
  public getSchema(): any {
    return this.metadata.inputSchema;
  }

  /**
   * Lifecycle hook called before tool execution
   * Override for custom pre-execution logic
   * @param input Validated input
   * @param context Optional player context
   */
  protected async onExecute(_input: TInput, _context?: PlayerContext): Promise<void> {
    // Override in subclasses if needed
  }

  /**
   * Handle errors with consistent logging
   * @param error The error that occurred
   * @param operation The operation that failed
   */
  protected handleError(error: Error, operation: string): void {
    logger.error(`Tool ${this.metadata.name} error during ${operation}:`, error);
    throw error;
  }

  /**
   * Update tool metadata
   * @param updates Partial metadata updates
   */
  protected updateMetadata(updates: Partial<ToolMetadata>): void {
    this.metadata = {
      ...this.metadata,
      ...updates,
    };
    logger.debug(`Tool ${this.metadata.name} metadata updated`);
  }

  /**
   * Check if tool supports player-specific context
   */
  public supportsPlayerContext(): boolean {
    return false; // Override in subclasses that support player context
  }

  /**
   * Get tool name
   */
  public getName(): string {
    return this.metadata.name;
  }

  /**
   * Get tool description
   */
  public getDescription(): string | undefined {
    return this.metadata.description;
  }

  /**
   * Validate tool configuration
   * Override for custom configuration validation
   */
  protected validateConfiguration(): boolean {
    return true;
  }
}