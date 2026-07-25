import { legacyIdSelector, legacyOptionalIdSelector, listQuery } from '../shared.js';
import type { CommandSpec } from '../types.js';

const entryBody = {
  projects: { apiName: 'projects', type: 'csv' as const }, task: { apiName: 'task' },
  duration: { apiName: 'duration', type: 'integer' as const },
  'start-time': { apiName: 'startTime' }, 'end-time': { apiName: 'endTime' },
  'is-overtime': { apiName: 'isOvertime', type: 'boolean' as const },
};
const entryUpdateBody = {
  projects: entryBody.projects,
  task: entryBody.task,
  duration: entryBody.duration,
};

export const timeCommands: CommandSpec[] = [
  { name: 'time timers list', method: 'GET', path: '/time/timers', query: listQuery({
    status: { apiName: 'status', choices: ['running', 'paused'] },
  }) },
  { name: 'time timers start', method: 'POST', path: '/time/timers', body: {
    project: { apiName: 'projects', type: 'singleton' }, task: { apiName: 'task' },
    'is-overtime': { apiName: 'isOvertime', type: 'boolean' },
  }, requiredOptions: ['project'] },
  {
    name: 'time timers pause',
    method: 'POST',
    ...legacyOptionalIdSelector('timer-id', 'timerId', '/time/timers/:timerId'),
    pathVariants: [{ path: '/time/timers/:timerId/pause', when: ['timer-id'] }],
    path: '/time/timers/:timerId/pause',
    timerEligibility: { status: 'running', positional: 'timer-id', pathParam: 'timerId' },
  },
  {
    name: 'time timers resume',
    method: 'POST',
    ...legacyOptionalIdSelector('timer-id', 'timerId', '/time/timers/:timerId/resume'),
    timerEligibility: { status: 'paused', positional: 'timer-id', pathParam: 'timerId' },
  },
  {
    name: 'time timers stop',
    method: 'POST',
    ...legacyOptionalIdSelector('timer-id', 'timerId', '/time/timers/:timerId/stop'),
    timerEligibility: { status: 'running', positional: 'timer-id', pathParam: 'timerId' },
  },
  { name: 'time timers stop-all', method: 'POST', path: '/time/timers/stop-all', confirmation: 'Stop all running timers?' },
  { name: 'time timers add-task', method: 'POST', ...legacyIdSelector('timer-id', 'timerId', '/time/timers/:timerId/tasks'), body: {
    task: { apiName: 'task' },
  }, requireBody: true },
  { name: 'time entries list', method: 'GET', path: '/time/entries', query: listQuery({
    project: { apiName: 'project' }, active: { apiName: 'active', type: 'boolean' },
    paused: { apiName: 'paused', type: 'boolean' },
    'start-date': { apiName: 'startDate' }, 'end-date': { apiName: 'endDate' },
    scope: { apiName: 'scope', choices: ['me', 'team'] },
    'user-id': { apiName: 'userId' },
  }), conditionalRequirements: [
    { option: 'user-id', requires: 'scope', value: 'team' },
  ] },
  { name: 'time entries get', method: 'GET', ...legacyIdSelector('entry-id', 'entryId', '/time/entries/:entryId') },
  { name: 'time entries create', method: 'POST', path: '/time/entries', body: entryBody, requireBody: true, requiredOptions: ['projects', 'task', 'duration'] },
  { name: 'time entries update', method: 'PATCH', ...legacyIdSelector('entry-id', 'entryId', '/time/entries/:entryId'), body: entryUpdateBody, requireBody: true },
  { name: 'time entries delete', method: 'DELETE', ...legacyIdSelector('entry-id', 'entryId', '/time/entries/:entryId'), confirmation: 'Delete time entry {entry-id}?' },
  {
    name: 'time timers start-many',
    method: 'POST',
    path: '/time/timers/start-many',
    body: {
      projects: { apiName: 'projects', type: 'csv', maxItems: 20, uniqueItems: true },
      task: { apiName: 'task' },
      'is-overtime': { apiName: 'isOvertime', type: 'boolean' },
    },
    requiredOptions: ['projects'],
  },
  { name: 'time workday status', method: 'GET', path: '/time/workday/status' },
  { name: 'time workday summary', method: 'GET', path: '/time/workday/summary' },
  {
    name: 'time workday end',
    method: 'POST',
    path: '/time/workday/end',
    confirmation: 'End the current workday and stop all active timers?',
  },
  {
    name: 'time entries today',
    method: 'GET',
    path: '/time/entries/today',
    query: listQuery({
      scope: { apiName: 'scope', choices: ['me', 'team'] },
      'user-id': { apiName: 'userId' },
      project: { apiName: 'project' },
    }),
    conditionalRequirements: [
      { option: 'user-id', requires: 'scope', value: 'team' },
    ],
  },
];
