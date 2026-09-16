import type { RequestOptions as HttpsRequestOptions } from 'node:https';
import type { Credentials } from '../config/types.js';
export declare const API_ROOT = "/api/cli/v1";
type QueryValue = string | number | boolean | string[] | undefined;
export interface MultipartFilePart {
    fieldName: string;
    filename: string;
    bytes: Uint8Array;
    contentType?: string;
}
export interface RequestOptions {
    query?: Record<string, QueryValue>;
    body?: unknown;
    /** When set, body fields and files are sent as multipart/form-data. */
    multipartFiles?: MultipartFilePart[];
}
export interface ApiClientOptions extends Credentials {
    version: string;
    clientName?: 'kooyahq-cli' | 'kooyahq-mcp';
    platform?: NodeJS.Platform;
    nodeVersion?: string;
    fetch?: typeof globalThis.fetch;
    timeoutMs?: number;
    maxResponseBytes?: number;
    retryDelayMs?: number;
}
export declare class ApiClient {
    private readonly options;
    private readonly fetchImplementation;
    private readonly baseUrl;
    private readonly platform;
    private readonly nodeVersion;
    private readonly timeoutMs;
    private readonly maxResponseBytes;
    constructor(options: ApiClientOptions);
    request<T = unknown>(method: string, path: string, requestOptions?: RequestOptions): Promise<T>;
    streamSse(path: string, requestOptions: RequestOptions, onEvent: (eventName: string, data: unknown) => void, signal?: AbortSignal): Promise<void>;
    private sendWithTimeout;
}
export declare function buildHttpsRequestOptions(url: URL, method: string, headers: Headers): HttpsRequestOptions;
export {};
