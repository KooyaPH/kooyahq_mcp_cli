import type { CommandSpec } from '../types.js';

export const presenceCommands: CommandSpec[] = [
  { name: 'presence locations list', method: 'GET', path: '/presence' },
];
