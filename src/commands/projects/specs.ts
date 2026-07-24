import { id, listQuery } from '../shared.js';
import type { CommandSpec } from '../types.js';

const body = {
  name: { apiName: 'name' }, emoji: { apiName: 'emoji' }, 'icon-url': { apiName: 'iconUrl' },
};

export const projectCommands: CommandSpec[] = [
  { name: 'projects list', method: 'GET', path: '/projects', query: listQuery({
    search: { apiName: 'search' },
  }) },
  { name: 'projects get', method: 'GET', path: '/projects/:id', positionals: [id()] },
  { name: 'projects create', method: 'POST', path: '/projects', body, requireBody: true, requiredOptions: ['name'] },
  { name: 'projects update', method: 'PATCH', path: '/projects/:id', positionals: [id()], body, requireBody: true },
  { name: 'projects delete', method: 'DELETE', path: '/projects/:id', positionals: [id()], confirmation: 'Delete project {id}?' },
];
