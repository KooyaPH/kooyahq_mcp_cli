import { legacyIdSelector, listQuery } from '../shared.js';
const rangeQuery = {
    'start-date': { apiName: 'startDate', format: 'date' },
    'end-date': { apiName: 'endDate', format: 'date' },
};
const dateRange = { startOption: 'start-date', endOption: 'end-date', maxDays: 366 };
const budgetDateRange = {
    startOption: 'start-date', endOption: 'end-date', maxDays: 366, requireDistinctDates: true,
};
const thresholdProperties = {
    warning: { type: 'number', minimum: 0, maximum: 100 },
    critical: { type: 'number', minimum: 0, maximum: 100 },
};
const thresholdOption = (required) => ({
    apiName: 'alertThresholds',
    type: 'json-object',
    jsonSchema: {
        type: 'object',
        properties: thresholdProperties,
        additionalProperties: false,
        ...(required ? { required: ['warning', 'critical'] } : {}),
    },
    jsonNumericOrder: [{ lower: 'warning', upper: 'critical' }],
    example: '{"warning":75,"critical":90}',
});
const budgetBaseBody = {
    project: { apiName: 'project', maxLength: 200 },
    'start-date': { apiName: 'startDate', format: 'date' },
    'end-date': { apiName: 'endDate', format: 'date' },
    amount: { apiName: 'amount', type: 'number', min: 0.01, max: 1_000_000_000_000_000 },
    currency: {
        apiName: 'currency', maxLength: 3, pattern: '^[A-Za-z]{3}$',
        patternDescription: 'three ASCII letters',
    },
};
const budgetCreateBody = { ...budgetBaseBody, 'alert-thresholds-json': thresholdOption(false) };
const budgetUpdateBody = {
    ...budgetBaseBody,
    'clear-project': { apiName: 'project', type: 'switch', constant: null },
    'alert-thresholds-json': thresholdOption(true),
};
export const analyticsCommands = [
    {
        name: 'analytics time', method: 'GET', path: '/analytics/time',
        query: { ...rangeQuery, 'user-id': { apiName: 'userId', format: 'object-id' } },
        requiredOptions: ['start-date', 'end-date'], dateRange,
    },
    ...['team', 'projects'].map((name) => ({
        name: `analytics ${name}`, method: 'GET', path: `/analytics/${name}`,
        query: rangeQuery, requiredOptions: ['start-date', 'end-date'], dateRange,
    })),
    {
        name: 'analytics costs', method: 'GET', path: '/analytics/costs', query: rangeQuery,
        pairedOptions: [['start-date', 'end-date']], dateRange,
    },
    { name: 'analytics costs live', method: 'GET', path: '/analytics/costs/live' },
    {
        name: 'analytics costs projects list',
        method: 'GET',
        path: '/analytics/costs/projects',
        query: listQuery({ search: { apiName: 'search', maxLength: 200 } }, ['name']),
    },
    {
        name: 'analytics costs projects get',
        method: 'GET',
        path: '/analytics/costs/projects/:project',
        pathParams: { project: { apiName: 'project', maxLength: 200 } },
        requiredOptions: ['project'],
        query: rangeQuery,
        dateRange,
        pairedOptions: [['start-date', 'end-date']],
    },
    {
        name: 'analytics costs budgets list',
        method: 'GET',
        path: '/analytics/costs/budgets',
        query: listQuery({ project: { apiName: 'project', maxLength: 200 }, search: { apiName: 'search', maxLength: 200 } }, ['project', 'startDate', 'endDate', 'amount', 'createdAt']),
    },
    {
        name: 'analytics costs budgets create',
        method: 'POST',
        path: '/analytics/costs/budgets',
        body: budgetCreateBody,
        requiredOptions: ['start-date', 'end-date', 'amount'],
        dateRange: budgetDateRange,
    },
    {
        name: 'analytics costs budgets update',
        method: 'PATCH',
        ...legacyIdSelector('budget-id', 'budgetId', '/analytics/costs/budgets/:budgetId'),
        body: budgetUpdateBody,
        requireBody: true,
        dateRange: budgetDateRange,
        pairedOptions: [['start-date', 'end-date']],
        atMostOne: [['project', 'clear-project']],
    },
    {
        name: 'analytics costs budgets delete',
        method: 'DELETE',
        ...legacyIdSelector('budget-id', 'budgetId', '/analytics/costs/budgets/:budgetId'),
        confirmation: 'Delete cost budget {budget-id}?',
    },
    {
        name: 'analytics costs budgets comparisons',
        method: 'GET',
        path: '/analytics/costs/budgets/comparisons',
        query: {
            ...listQuery({ project: { apiName: 'project', maxLength: 200 }, search: { apiName: 'search', maxLength: 200 } }, ['project', 'startDate', 'endDate', 'amount', 'createdAt']),
            limit: { apiName: 'limit', type: 'integer', max: 20 },
        },
    },
    {
        name: 'analytics costs forecast',
        method: 'GET',
        path: '/analytics/costs/forecast',
        query: {
            ...rangeQuery,
            days: { apiName: 'days', type: 'integer', min: 1, max: 365 },
            project: { apiName: 'project', maxLength: 200 },
        },
        requiredOptions: ['start-date', 'end-date'],
        dateRange,
    },
    {
        name: 'analytics costs compare',
        method: 'GET',
        path: '/analytics/costs/compare',
        query: {
            'current-start': { apiName: 'currentStart', format: 'date' },
            'current-end': { apiName: 'currentEnd', format: 'date' },
            'previous-start': { apiName: 'previousStart', format: 'date' },
            'previous-end': { apiName: 'previousEnd', format: 'date' },
            project: { apiName: 'project', maxLength: 200 },
        },
        requiredOptions: ['current-start', 'current-end', 'previous-start', 'previous-end'],
        dateRange: [
            { startOption: 'current-start', endOption: 'current-end', maxDays: 366 },
            { startOption: 'previous-start', endOption: 'previous-end', maxDays: 366 },
        ],
    },
];
//# sourceMappingURL=specs.js.map