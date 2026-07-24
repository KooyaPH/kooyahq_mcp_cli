import { id, listQuery } from '../shared.js';
import type { CommandSpec } from '../types.js';

const boardCreateBody = {
  name: { apiName: 'name' }, type: { apiName: 'type' }, description: { apiName: 'description' },
  prefix: { apiName: 'prefix' }, emoji: { apiName: 'emoji' },
  'columns-json': { apiName: 'columns', type: 'json-array' as const },
  'settings-json': { apiName: 'settings', type: 'json-object' as const },
};
const { type: _type, ...boardUpdateBody } = boardCreateBody;
const settingsBody = {
  'default-view': { apiName: 'defaultView' },
  'show-swimlanes': { apiName: 'showSwimlanes', type: 'boolean' as const },
};

export const boardCommands: CommandSpec[] = [
  { name: 'boards list', method: 'GET', path: '/boards', query: listQuery({
    search: { apiName: 'search' }, type: { apiName: 'type' },
  }) },
  { name: 'boards get', method: 'GET', path: '/boards/:id', positionals: [id()] },
  { name: 'boards create', method: 'POST', path: '/boards', body: boardCreateBody, requireBody: true, requiredOptions: ['name', 'type'] },
  { name: 'boards update', method: 'PATCH', path: '/boards/:id', positionals: [id()], body: boardUpdateBody, requireBody: true },
  { name: 'boards delete', method: 'DELETE', path: '/boards/:id', positionals: [id()], confirmation: 'Delete board {id}?' },
  { name: 'boards favorite', method: 'POST', path: '/boards/:id/favorite', positionals: [id()] },
  { name: 'boards settings get', method: 'GET', path: '/boards/:id/settings', positionals: [id()] },
  { name: 'boards settings update', method: 'PATCH', path: '/boards/:id/settings', positionals: [id()], body: settingsBody, requireBody: true },
  { name: 'boards members list', method: 'GET', path: '/boards/:boardId/members', positionals: [id('boardId')], query: listQuery({
    search: { apiName: 'search' }, role: { apiName: 'role' },
  }) },
  { name: 'boards members add', method: 'POST', path: '/boards/:boardId/members', positionals: [id('boardId')], body: {
    'user-id': { apiName: 'userId' }, role: { apiName: 'role' },
  }, requireBody: true, requiredOptions: ['user-id', 'role'] },
  { name: 'boards members update-role', method: 'PATCH', path: '/boards/:boardId/members', positionals: [id('boardId'), id('userId')], bodyPositionals: { userId: 'userId' }, body: {
    role: { apiName: 'role' },
  }, requireBody: true, requiredOptions: ['role'] },
  { name: 'boards members remove', method: 'DELETE', path: '/boards/:boardId/members', positionals: [id('boardId'), id('userId')], bodyPositionals: { userId: 'userId' }, confirmation: 'Remove member {userId} from board {boardId}?' },
];
