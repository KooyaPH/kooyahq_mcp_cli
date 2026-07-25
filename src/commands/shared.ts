import type { CommandSpec, OptionSpec } from './types.js';

export function listQuery(
  filters: Record<string, OptionSpec> = {},
  sortableFields: string[] = ['createdAt', 'updatedAt'],
): Record<string, OptionSpec> {
  return {
    page: { apiName: 'page', type: 'integer', max: 100 },
    limit: { apiName: 'limit', type: 'integer', max: 100 },
    sort: { apiName: 'sortBy', choices: sortableFields },
    order: { apiName: 'sortOrder', choices: ['asc', 'desc'] },
    ...filters,
  };
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
    pathParams: { [flag]: { apiName: pathParam, format: 'object-id' } },
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
    pathParams: { [flag]: { apiName: pathParam, format: 'object-id' } },
    positionals: [{
      name: positionalName,
      optional: true,
      aliasFor: flag,
      deprecated: true,
    }],
  };
}
