import { type RuntimeDependencies } from '../runtime/run.js';
export type McpBridgeDependencies = RuntimeDependencies;
interface McpToolDefinition {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
        additionalProperties: false;
    };
}
export declare function mcpToolDefinitions(): McpToolDefinition[];
export declare function callMcpTool(name: string, input: unknown, dependencies: McpBridgeDependencies): Promise<unknown>;
export {};
