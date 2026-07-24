import { ApiError, NetworkError, ValidationError } from '../core/errors.js';
import type { Credentials } from '../config/types.js';
import { validateBaseUrl } from '../config/url.js';

export const API_ROOT = '/api/cli/v1';
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

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
    const controller = new AbortController();
    const init: RequestInit = { method, headers, redirect: 'error', signal: controller.signal };
    if (requestOptions.body !== undefined) {
      headers.set('content-type', 'application/json');
      init.body = JSON.stringify(requestOptions.body);
    }

    let response: Response;
    let timeout: NodeJS.Timeout | undefined;
    try {
      response = await new Promise<Response>((resolve, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new NetworkError('Unable to reach KooyaHQ before the request timeout.'));
        }, this.timeoutMs);
        void this.fetchImplementation(url, init).then(resolve, reject);
      });
    } catch {
      throw new NetworkError();
    } finally {
      if (timeout) clearTimeout(timeout);
    }
    const payload = await parseResponse(response, this.maxResponseBytes);
    if (!response.ok) {
      throw new ApiError(
        redactCredentials(errorMessage(payload, response.status), this.options),
        response.status,
      );
    }
    return payload as T;
  }
}

async function parseResponse(response: Response, maxResponseBytes: number): Promise<unknown> {
  const contentLength = response.headers.get('content-length');
  if (contentLength && Number(contentLength) > maxResponseBytes) {
    throw new NetworkError('KooyaHQ API response was too large.');
  }
  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > maxResponseBytes) {
    throw new NetworkError('KooyaHQ API response was too large.');
  }
  if (!text) return undefined;
  if (!(response.headers.get('content-type') ?? '').toLowerCase().includes('application/json')) {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
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
