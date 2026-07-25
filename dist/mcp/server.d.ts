import type { Readable, Writable } from 'node:stream';
import type { McpBridgeDependencies } from './bridge.js';
type JsonValue = null | boolean | number | string | JsonValue[] | {
    [key: string]: JsonValue;
};
type JsonRpcId = string | number | null;
interface JsonRpcMessage {
    jsonrpc?: string;
    id?: JsonRpcId;
    method?: string;
    params?: unknown;
}
interface JsonRpcSuccess {
    jsonrpc: '2.0';
    id: JsonRpcId;
    result: JsonValue | Record<string, unknown>;
}
interface JsonRpcError {
    jsonrpc: '2.0';
    id: JsonRpcId;
    error: {
        code: number;
        message: string;
    };
}
export interface McpServerStreams {
    input: Readable;
    output: Writable;
    error: Writable;
}
export declare function runMcpServer(dependencies: McpBridgeDependencies, streams?: McpServerStreams): void;
export declare function handleMcpMessage(message: JsonRpcMessage, dependencies: McpBridgeDependencies): Promise<JsonRpcSuccess | JsonRpcError | undefined>;
export {};
