import type { RequestOptions as HttpsRequestOptions } from 'node:https';
import type { Credentials } from '../config/types.js';
export declare const API_ROOT = "/api/cli/v1";
type QueryValue = string | number | boolean | string[] | undefined;
export interface RequestOptions {
    query?: Record<string, QueryValue>;
    body?: unknown;
}
export interface ApiClientOptions extends Credentials {
    version: string;
    platform?: NodeJS.Platform;
    nodeVersion?: string;
    fetch?: typeof globalThis.fetch;
    timeoutMs?: number;
    maxResponseBytes?: number;
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
}
export declare function buildHttpsRequestOptions(url: URL, method: string, headers: Headers): HttpsRequestOptions;
export {};
