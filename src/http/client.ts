import { ApiError, NetworkError, ValidationError } from '../core/errors.js';
import type { Credentials } from '../config/types.js';
import { validateBaseUrl } from '../config/url.js';

export const API_ROOT = '/api/cli/v1';

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
}

export class ApiClient {
  private readonly fetchImplementation: typeof globalThis.fetch;
  private readonly baseUrl: string;
  private readonly platform: NodeJS.Platform;
  private readonly nodeVersion: string;

  constructor(private readonly options: ApiClientOptions) {
    if (!options.accessKeyId.trim() || !options.secretAccessKey.trim()) {
      throw new ValidationError('Complete, non-blank credentials are required before a network request.');
    }
    this.baseUrl = validateBaseUrl(options.baseUrl);
    this.fetchImplementation = options.fetch ?? globalThis.fetch;
    this.platform = options.platform ?? process.platform;
    this.nodeVersion = options.nodeVersion ?? process.versions.node;
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

    let response: Response;
    try {
      response = await this.fetchImplementation(url, init);
    } catch {
      throw new NetworkError();
    }
    const payload = await parseResponse(response);
    if (!response.ok) {
      throw new ApiError(
        redactCredentials(errorMessage(payload, response.status), this.options),
        response.status,
      );
    }
    return payload as T;
  }
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text();
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
  }
  return `KooyaHQ API request failed with status ${status}.`;
}

function redactCredentials(message: string, credentials: Credentials): string {
  return [credentials.secretAccessKey, credentials.accessKeyId]
    .filter(Boolean)
    .reduce((safe, credential) => safe.split(credential).join('[REDACTED]'), message);
}
