import type { CommandSpec, OptionSpec } from './types.js';

const sortableFields = [
  'createdAt', 'updatedAt', 'name', 'title', 'email', 'status', 'priority',
  'duration', 'startTime', 'endTime', 'occurredAt',
];

export const listOptions: Record<string, OptionSpec> = {
  page: { apiName: 'page', type: 'integer' },
  limit: { apiName: 'limit', type: 'integer' },
  sort: { apiName: 'sortBy', choices: sortableFields },
  order: { apiName: 'sortOrder', choices: ['asc', 'desc'] },
};

export function listQuery(filters: Record<string, OptionSpec> = {}): Record<string, OptionSpec> {
  return { ...listOptions, ...filters };
}

export const id = (name = 'id') => ({ name });
export const optionalId = (name = 'id') => ({ name, optional: true as const });

export function legacyIdSelector(
  flag: string,
  pathParam: string,
  path: string,
  positionalName = 'id',
): Pick<CommandSpec, 'path' | 'pathParams' | 'positionals' | 'requiredOptions'> {
  return {
    path,
    pathParams: { [flag]: { apiName: pathParam } },
    positionals: [{
      name: positionalName,
      optional: true,
      aliasFor: flag,
      deprecated: true,
    }],
    requiredOptions: [flag],
  };
}

export function legacyOptionalIdSelector(
  flag: string,
  pathParam: string,
  path: string,
  positionalName = 'id',
): Pick<CommandSpec, 'path' | 'pathParams' | 'positionals'> {
  return {
    path,
    pathParams: { [flag]: { apiName: pathParam } },
    positionals: [{
      name: positionalName,
      optional: true,
      aliasFor: flag,
      deprecated: true,
    }],
  };
}
