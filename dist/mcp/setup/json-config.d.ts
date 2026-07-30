import { type LocalMcpDescriptor } from './local-client.js';
export interface JsonMcpConfig {
    mcpServers?: Record<string, unknown>;
    [key: string]: unknown;
}
export declare function readJsonMcpConfig(path: string, clientName: string): Promise<JsonMcpConfig>;
export declare function installJsonMcpEntry(path: string, descriptor: LocalMcpDescriptor, clientName: string): Promise<void>;
