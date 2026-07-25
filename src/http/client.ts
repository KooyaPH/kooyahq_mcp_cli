import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { RequestOptions as HttpsRequestOptions } from 'node:https';

import { ApiError, NetworkError, ValidationError } from '../core/errors.js';
import type { Credentials } from '../config/types.js';
import { validateBaseUrl } from '../config/url.js';

export const API_ROOT = '/api/cli/v1';
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const DEFAULT_GET_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 250;

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
  retryDelayMs?: number;
}

export class ApiClient {
  private readonly fetchImplementation: typeof globalThis.fetch;
  private readonly baseUrl: string;
  private readonly platform: NodeJS.Platform;
  private readonly nodeVersion: string;
  private readonly timeoutMs: number;
  private readonly maxResponseBytes: number;

  constructor(private readonly options: ApiClientOptions) {
    if (!options.accessKeyId.trim() || !options.secretAccessKey.trim()) {
      throw new ValidationError('Complete, non-blank credentials are required before a network request.');
    }
    this.baseUrl = validateBaseUrl(options.baseUrl);
    this.fetchImplementation = options.fetch ?? globalThis.fetch;
    this.platform = options.platform ?? process.platform;
    this.nodeVersion = options.nodeVersion ?? process.versions.node;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  }

  async request<T = unknown>(
    method: string,
    path: string,
    requestOptions: RequestOptions = {},
  ): Promise<T> {
    const url = new URL(`${API_ROOT}${path}`, this.baseUrl);
    for (const [key, value] of Object.entries(requestOptions.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const headers = new Headers({
      accept: 'application/json',
      authorization: `KooyaKey ${this.options.accessKeyId}:${this.options.secretAccessKey}`,
      'user-agent': `kooyahq-cli/${this.options.version} (${this.platform}; node/${this.nodeVersion})`,
    });
    const init: RequestInit = { method, headers, redirect: 'error' };
    if (requestOptions.body !== undefined) {
      headers.set('content-type', 'application/json');
      init.body = JSON.stringify(requestOptions.body);
    }

    const attempts = method.toUpperCase() === 'GET' ? DEFAULT_GET_RETRIES + 1 : 1;
    let response: Response | undefined;
    try {
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
          response = await this.sendWithTimeout(url, method, headers, init);
          break;
        } catch (error) {
          if (attempt === attempts) throw error;
          await delay(this.options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS);
        }
      }
    } catch {
      throw new NetworkError();
    }
    if (!response) throw new NetworkError();
    const payload = await parseResponse(response, this.maxResponseBytes);
    if (!response.ok) {
      throw new ApiError(
        redactCredentials(errorMessage(payload, response.status), this.options),
        response.status,
      );
    }
    return payload as T;
  }

  private async sendWithTimeout(
    url: URL,
    method: string,
    headers: Headers,
    init: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    init.signal = controller.signal;
    let timeout: NodeJS.Timeout | undefined;
    try {
      return await new Promise<Response>((resolve, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new NetworkError('Unable to reach KooyaHQ before the request timeout.'));
        }, this.timeoutMs);
        const request = this.options.fetch
          ? this.fetchImplementation(url, init)
          : nodeNativeRequest(url, method, headers, init.body, this.maxResponseBytes);
        void request.then(resolve, reject);
      });
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildHttpsRequestOptions(
  url: URL,
  method: string,
  headers: Headers,
): HttpsRequestOptions {
  return {
    method,
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port || undefined,
    path: `${url.pathname}${url.search}`,
    headers: Object.fromEntries(headers.entries()),
    family: 4,
    servername: url.hostname,
  };
}

function nodeNativeRequest(
  url: URL,
  method: string,
  headers: Headers,
  body: BodyInit | null | undefined,
  maxResponseBytes: number,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const requestImplementation = url.protocol === 'http:' ? httpRequest : httpsRequest;
    const request = requestImplementation(buildHttpsRequestOptions(url, method, headers), (response) => {
      const chunks: Buffer[] = [];
      let totalBytes = 0;
      let settled = false;
      const rejectOnce = (error: Error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      const contentLength = Number(response.headers['content-length']);
      if (Number.isFinite(contentLength) && contentLength > maxResponseBytes) {
        response.resume();
        rejectOnce(new NetworkError('KooyaHQ API response was too large.'));
        return;
      }
      response.on('data', (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        totalBytes += buffer.byteLength;
        if (totalBytes > maxResponseBytes) {
          response.destroy();
          rejectOnce(new NetworkError('KooyaHQ API response was too large.'));
          return;
        }
        chunks.push(buffer);
      });
      response.on('end', () => {
        if (settled) return;
        settled = true;
        resolve(new Response(Buffer.concat(chunks), {
          status: response.statusCode ?? 0,
          statusText: response.statusMessage ?? '',
          headers: response.headers as HeadersInit,
        }));
      });
      response.on('error', rejectOnce);
    });
    request.on('error', reject);
    if (body !== undefined && body !== null) request.write(body);
    request.end();
  });
}

async function parseResponse(response: Response, maxResponseBytes: number): Promise<unknown> {
  const contentLength = response.headers.get('content-length');
  if (contentLength && Number(contentLength) > maxResponseBytes) {
    throw new NetworkError('KooyaHQ API response was too large.');
  }
  const text = await readBoundedResponseText(response, maxResponseBytes);
  if (!text) return undefined;
  if (!(response.headers.get('content-type') ?? '').toLowerCase().includes('application/json')) return text;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new NetworkError('KooyaHQ API returned invalid JSON.');
  }
}

async function readBoundedResponseText(
  response: Response,
  maxResponseBytes: number,
): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxResponseBytes) {
        await reader.cancel();
        throw new NetworkError('KooyaHQ API response was too large.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function errorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === 'object') {
    const value = payload as Record<string, unknown>;
    if (typeof value.message === 'string' && value.message.trim()) return value.message.trim();
    if (typeof value.error === 'string' && value.error.trim()) return value.error.trim();
    if (value.error && typeof value.error === 'object') {
      const nested = value.error as Record<string, unknown>;
      if (typeof nested.message === 'string' && nested.message.trim()) return nested.message.trim();
    }
  }
  return `KooyaHQ API request failed with status ${status}.`;
}

function redactCredentials(message: string, credentials: Credentials): string {
  return [credentials.secretAccessKey, credentials.accessKeyId]
    .filter(Boolean)
    .reduce((safe, credential) => safe.split(credential).join('[REDACTED]'), message);
}
