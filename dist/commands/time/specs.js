import { id, listQuery, optionalId } from '../shared.js';
const entryBody = {
    projects: { apiName: 'projects', type: 'csv' }, task: { apiName: 'task' },
    duration: { apiName: 'duration', type: 'integer' },
    'start-time': { apiName: 'startTime' }, 'end-time': { apiName: 'endTime' },
    'is-overtime': { apiName: 'isOvertime', type: 'boolean' },
};
const entryUpdateBody = {
    projects: entryBody.projects,
    task: entryBody.task,
    duration: entryBody.duration,
};
export const timeCommands = [
    { name: 'time timers list', method: 'GET', path: '/time/timers', query: listQuery({
            status: { apiName: 'status', choices: ['running', 'paused'] },
        }) },
    { name: 'time timers start', method: 'POST', path: '/time/timers', body: {
            project: { apiName: 'projects', type: 'singleton' }, task: { apiName: 'task' },
            'is-overtime': { apiName: 'isOvertime', type: 'boolean' },
        }, requiredOptions: ['project'] },
    { name: 'time timers pause', method: 'POST', path: '/time/timers/:id/pause', positionals: [optionalId()], timerEligibility: { status: 'running', positional: 'id' } },
    { name: 'time timers resume', method: 'POST', path: '/time/timers/:id/resume', positionals: [optionalId()], timerEligibility: { status: 'paused', positional: 'id' } },
    { name: 'time timers stop', method: 'POST', path: '/time/timers/:id/stop', positionals: [optionalId()], timerEligibility: { status: 'running', positional: 'id' } },
    { name: 'time timers stop-all', method: 'POST', path: '/time/timers/stop-all', confirmation: 'Stop all running timers?' },
    { name: 'time timers add-task', method: 'POST', path: '/time/timers/:id/tasks', positionals: [id()], body: {
            task: { apiName: 'task' },
        }, requireBody: true },
    { name: 'time entries list', method: 'GET', path: '/time/entries', query: listQuery({
            project: { apiName: 'project' }, active: { apiName: 'active', type: 'boolean' },
            paused: { apiName: 'paused', type: 'boolean' },
            'start-date': { apiName: 'startDate' }, 'end-date': { apiName: 'endDate' },
        }) },
    { name: 'time entries get', method: 'GET', path: '/time/entries/:id', positionals: [id()] },
    { name: 'time entries create', method: 'POST', path: '/time/entries', body: entryBody, requireBody: true, requiredOptions: ['projects', 'task', 'duration'] },
    { name: 'time entries update', method: 'PATCH', path: '/time/entries/:id', positionals: [id()], body: entryUpdateBody, requireBody: true },
    { name: 'time entries delete', method: 'DELETE', path: '/time/entries/:id', positionals: [id()], confirmation: 'Delete time entry {id}?' },
];
//# sourceMappingURL=specs.js.map