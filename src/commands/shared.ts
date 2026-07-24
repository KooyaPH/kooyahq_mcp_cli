import type { OptionSpec } from './types.js';

export const listOptions: Record<string, OptionSpec> = {
  page: { apiName: 'page', type: 'integer' },
  limit: { apiName: 'limit', type: 'integer' },
  sort: { apiName: 'sortBy' },
  order: { apiName: 'sortOrder' },
};

export function listQuery(filters: Record<string, OptionSpec> = {}): Record<string, OptionSpec> {
  return { ...listOptions, ...filters };
}

export const id = (name = 'id') => ({ name });
export const optionalId = (name = 'id') => ({ name, optional: true as const });
