const analyticsQuery = {
    'start-date': { apiName: 'startDate' }, 'end-date': { apiName: 'endDate' },
};
export const analyticsCommands = ['time', 'team', 'projects', 'costs'].map((name) => ({
    name: `analytics ${name}`,
    method: 'GET',
    path: `/analytics/${name}`,
    query: analyticsQuery,
    requiredOptions: ['start-date', 'end-date'],
}));
//# sourceMappingURL=specs.js.map