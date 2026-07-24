const sortableFields = [
    'createdAt', 'updatedAt', 'name', 'title', 'email', 'status', 'priority',
    'duration', 'startTime', 'endTime', 'occurredAt',
];
export const listOptions = {
    page: { apiName: 'page', type: 'integer' },
    limit: { apiName: 'limit', type: 'integer' },
    sort: { apiName: 'sortBy', choices: sortableFields },
    order: { apiName: 'sortOrder' },
};
export function listQuery(filters = {}) {
    return { ...listOptions, ...filters };
}
export const id = (name = 'id') => ({ name });
export const optionalId = (name = 'id') => ({ name, optional: true });
//# sourceMappingURL=shared.js.map