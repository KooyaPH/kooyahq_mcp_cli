import { legacyIdSelector, listQuery } from '../shared.js';
import type { CommandSpec } from '../types.js';

const body = {
  name: { apiName: 'name', maxLength: 100 },
  emoji: { apiName: 'emoji', maxLength: 32 },
  'icon-url': { apiName: 'iconUrl', format: 'https-url' as const, maxLength: 2_048 },
};
const updateBody = {
  ...body,
  'clear-emoji': { apiName: 'emoji', type: 'switch' as const, constant: '' },
  'clear-icon-url': { apiName: 'iconUrl', type: 'switch' as const, constant: '' },
};

export const projectCommands: CommandSpec[] = [
  { name: 'projects list', method: 'GET', path: '/projects', query: listQuery({
    search: { apiName: 'search' },
  }, ['name', 'createdAt']) },
  { name: 'projects get', method: 'GET', ...legacyIdSelector('project-id', 'projectId', '/projects/:projectId') },
  { name: 'projects create', method: 'POST', path: '/projects', body, requireBody: true, requiredOptions: ['name'] },
  {
    name: 'projects update', method: 'PATCH',
    ...legacyIdSelector('project-id', 'projectId', '/projects/:projectId'),
    body: updateBody,
    requireBody: true,
    atMostOne: [['emoji', 'clear-emoji'], ['icon-url', 'clear-icon-url']],
  },
  { name: 'projects delete', method: 'DELETE', ...legacyIdSelector('project-id', 'projectId', '/projects/:projectId'), confirmation: 'Delete project {project-id}?' },
  {
    name: 'projects keyword-migration preview',
    method: 'POST',
    path: '/projects/keyword-migration/preview',
    body: { 'source-projects': { apiName: 'sourceProjects', type: 'csv', maxItems: 100, uniqueItems: true } },
  },
  {
    name: 'projects keyword-migration apply',
    method: 'POST',
    path: '/projects/keyword-migration',
    body: { 'source-projects': { apiName: 'sourceProjects', type: 'csv', maxItems: 100, uniqueItems: true } },
    confirmation: 'Apply keyword-based time entry migration?',
  },
];
