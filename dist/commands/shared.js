export function listQuery(filters = {}, sortableFields = ['createdAt', 'updatedAt']) {
    return {
        page: { apiName: 'page', type: 'integer', max: 100 },
        limit: { apiName: 'limit', type: 'integer', max: 100 },
        sort: { apiName: 'sortBy', choices: sortableFields },
        order: { apiName: 'sortOrder', choices: ['asc', 'desc'] },
        ...filters,
    };
}
export const id = (name = 'id') => ({ name });
export const optionalId = (name = 'id') => ({ name, optional: true });
export function legacyIdSelector(flag, pathParam, path, positionalName = 'id') {
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
export function legacyOptionalIdSelector(flag, pathParam, path, positionalName = 'id') {
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
//# sourceMappingURL=shared.js.map