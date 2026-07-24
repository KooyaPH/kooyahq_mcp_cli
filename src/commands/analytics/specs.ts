import type { CommandSpec, OptionSpec } from '../types.js';

const analyticsQuery: Record<string, OptionSpec> = {
  'start-date': { apiName: 'startDate' }, 'end-date': { apiName: 'endDate' },
};

export const analyticsCommands: CommandSpec[] = ['time', 'team', 'projects', 'costs'].map((name) => ({
  name: `analytics ${name}`,
  method: 'GET',
  path: `/analytics/${name}`,
  query: analyticsQuery,
  requiredOptions: ['start-date', 'end-date'],
}));
