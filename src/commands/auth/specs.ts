import type { CommandSpec } from '../types.js';

export const authCommands: CommandSpec[] = [
  { name: 'auth whoami', method: 'GET', path: '/whoami' },
];
