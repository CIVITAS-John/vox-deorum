import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types";
import { ZodRawShape } from "zod";
import { MCPServer } from '../server.js';

/**
 * Base class for all tools
 */
export abstract class ToolBase<InputSchema extends ZodRawShape, OutputSchema extends ZodRawShape> {
    /**
     * Name of the tool
     */
    abstract Name: string;

    /**
     * Title of the tool
     */
    abstract Title: string;

    /**
     * Description of the tool
     */
    abstract Description: string;

    /**
     * Input schema for the tool
     */
    abstract InputSchema: InputSchema;

    /** 
     * Output schema for the tool 
     */
    abstract OutputSchema: OutputSchema;

    /**
     * Tool annotations
     */
    abstract Annotations: ToolAnnotations;

    /**
     * Execute the tool with the given input
     */
    abstract Execute: ToolCallback<InputSchema>;

    /**
     * Register the tool with the MCP server
     */
    public Register(): void {
        MCPServer.getInstance().addTool(this);
    }
}