import { ValidationError } from '../core/errors.js';

export const DEFAULT_BASE_URL = 'https://hq-be.kooyaai.com';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function validateBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new ValidationError('Base URL must be a valid absolute URL.');
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new ValidationError('Base URL must not contain user info, a query, or a fragment.');
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    throw new ValidationError('Base URL must be an origin without a path.');
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname))) {
    throw new ValidationError('Base URL must use HTTPS, except for localhost.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new ValidationError('Base URL must use HTTP or HTTPS.');
  }

  return url.origin;
}
