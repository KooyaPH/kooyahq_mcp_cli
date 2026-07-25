const sortableFields = [
    'createdAt', 'updatedAt', 'name', 'title', 'email', 'status', 'priority',
    'duration', 'startTime', 'endTime', 'occurredAt',
];
export const listOptions = {
    page: { apiName: 'page', type: 'integer' },
    limit: { apiName: 'limit', type: 'integer' },
    sort: { apiName: 'sortBy', choices: sortableFields },
    order: { apiName: 'sortOrder', choices: ['asc', 'desc'] },
};
export function listQuery(filters = {}) {
    return { ...listOptions, ...filters };
}
export const id = (name = 'id') => ({ name });
export const optionalId = (name = 'id') => ({ name, optional: true });
export function legacyIdSelector(flag, pathParam, path, positionalName = 'id') {
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
export function legacyOptionalIdSelector(flag, pathParam, path, positionalName = 'id') {
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
//# sourceMappingURL=shared.js.map