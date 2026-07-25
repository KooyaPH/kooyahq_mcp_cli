import { legacyIdSelector, listQuery } from '../shared.js';
import type { CommandSpec, OptionSpec } from '../types.js';

const rangeQuery: Record<string, OptionSpec> = {
  'start-date': { apiName: 'startDate', format: 'date' },
  'end-date': { apiName: 'endDate', format: 'date' },
};

const analyticsQuery: Record<string, OptionSpec> = {
  ...rangeQuery,
  'user-id': { apiName: 'userId', maxLength: 200 },
};

const dateRange = { startOption: 'start-date', endOption: 'end-date', maxDays: 366 } as const;

const budgetBody = {
  project: { apiName: 'project', maxLength: 200 },
  'start-date': { apiName: 'startDate', format: 'date' as const },
  'end-date': { apiName: 'endDate', format: 'date' as const },
  amount: { apiName: 'amount', type: 'number' as const, min: 0.01 },
  currency: { apiName: 'currency', maxLength: 3 },
  'alert-thresholds-json': { apiName: 'alertThresholds', type: 'json-object' as const },
};

export const analyticsCommands: CommandSpec[] = [
  ...['time', 'team', 'projects', 'costs'].map((name): CommandSpec => ({
    name: `analytics ${name}`,
    method: 'GET',
    path: `/analytics/${name}`,
    query: analyticsQuery,
    requiredOptions: ['start-date', 'end-date'],
    dateRange,
  })),
  { name: 'analytics costs live', method: 'GET', path: '/analytics/costs/live' },
  {
    name: 'analytics costs projects list',
    method: 'GET',
    path: '/analytics/costs/projects',
    query: listQuery(),
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
    query: listQuery({ project: { apiName: 'project', maxLength: 200 } }),
  },
  {
    name: 'analytics costs budgets create',
    method: 'POST',
    path: '/analytics/costs/budgets',
    body: budgetBody,
    requiredOptions: ['start-date', 'end-date', 'amount'],
    dateRange,
  },
  {
    name: 'analytics costs budgets update',
    method: 'PATCH',
    ...legacyIdSelector('budget-id', 'budgetId', '/analytics/costs/budgets/:budgetId'),
    body: budgetBody,
    requireBody: true,
    dateRange,
    pairedOptions: [['start-date', 'end-date']],
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
    query: listQuery(),
  },
  {
    name: 'analytics costs forecast',
    method: 'GET',
    path: '/analytics/costs/forecast',
    query: {
      ...rangeQuery,
      days: { apiName: 'days', type: 'integer', min: 1, max: 366 },
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
  },
];
