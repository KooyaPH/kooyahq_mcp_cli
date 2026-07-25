import { legacyIdSelector, listQuery } from '../shared.js';
import type { CommandSpec } from '../types.js';
import { USER_PERMISSION_CHOICES } from './permissions.js';

const ADMIN_ACTIONS = [
  'create_user',
  'update_user',
  'delete_user',
  'create_client',
  'create_project',
  'update_project',
  'delete_project',
  'update_oidc_access',
  'create_oidc_application',
  'update_oidc_application',
  'rotate_oidc_secret',
  'delete_oidc_application',
  'update_system_settings',
];

const userBody = {
  name: { apiName: 'name', maxLength: 200 },
  email: { apiName: 'email', format: 'email' as const }, position: { apiName: 'position', maxLength: 200 },
  birthday: { apiName: 'birthday', format: 'date' as const },
  status: { apiName: 'status', choices: ['online', 'busy', 'away', 'offline'] },
  permissions: {
    apiName: 'permissions', type: 'csv' as const,
    itemChoices: [...USER_PERMISSION_CHOICES],
    uniqueItems: true,
  }, bio: { apiName: 'bio', maxLength: 5000 },
  'whatsapp-phone': { apiName: 'whatsappPhone', maxLength: 30 },
  'monthly-salary': { apiName: 'monthlySalary', type: 'number' as const, min: 0, max: 1_000_000_000_000_000 },
};
const userUpdateBody = {
  ...userBody,
  disabled: { apiName: 'disabled', type: 'boolean' as const },
  'clear-whatsapp-phone': { apiName: 'whatsappPhone', type: 'switch' as const, constant: null },
  'clear-permissions': { apiName: 'permissions', type: 'switch' as const, constant: [] },
  'clear-position': { apiName: 'position', type: 'switch' as const, constant: '' },
  'clear-birthday': { apiName: 'birthday', type: 'switch' as const, constant: '' },
  'clear-bio': { apiName: 'bio', type: 'switch' as const, constant: '' },
};

export const userCommands: CommandSpec[] = [
  { name: 'users list', method: 'GET', path: '/users', query: listQuery({
    search: { apiName: 'search' },
    'include-disabled': { apiName: 'includeDisabled', type: 'boolean' },
    position: { apiName: 'position', maxLength: 200 },
    status: { apiName: 'status', choices: ['online', 'busy', 'away', 'offline'] },
    'created-from': { apiName: 'createdFrom', format: 'date' },
    'created-to': { apiName: 'createdTo', format: 'date' },
  }, ['name', 'createdAt']), dateRange: {
    startOption: 'created-from', endOption: 'created-to', maxDays: 366,
  } },
  { name: 'users get', method: 'GET', ...legacyIdSelector('user-id', 'userId', '/users/:userId') },
  { name: 'users create', method: 'POST', path: '/users', body: userBody, requireBody: true, requiredOptions: ['name', 'email'] },
  {
    name: 'users update', method: 'PATCH',
    ...legacyIdSelector('user-id', 'userId', '/users/:userId'),
    body: userUpdateBody,
    requireBody: true,
    atMostOne: [
      ['whatsapp-phone', 'clear-whatsapp-phone'],
      ['permissions', 'clear-permissions'],
      ['position', 'clear-position'],
      ['birthday', 'clear-birthday'],
      ['bio', 'clear-bio'],
    ],
  },
  { name: 'users delete', method: 'DELETE', ...legacyIdSelector('user-id', 'userId', '/users/:userId'), confirmation: 'Delete user {user-id}?' },
  { name: 'users stats', method: 'GET', path: '/users/stats' },
  { name: 'users permissions get', method: 'GET', ...legacyIdSelector('user-id', 'userId', '/users/:userId/permissions') },
  { name: 'users permissions update', method: 'PATCH', ...legacyIdSelector('user-id', 'userId', '/users/:userId/permissions'), body: {
    permissions: {
      apiName: 'permissions', type: 'csv',
      itemChoices: [...USER_PERMISSION_CHOICES],
      uniqueItems: true,
    },
    'clear-permissions': { apiName: 'permissions', type: 'switch', constant: [] },
  }, requireBody: true, atMostOne: [['permissions', 'clear-permissions']] },
  { name: 'users templates list', method: 'GET', path: '/users/templates', query: listQuery({ search: { apiName: 'search' } }, ['id', 'label']) },
  {
    name: 'users templates get', method: 'GET', path: '/users/templates/:templateId',
    pathParams: { 'template-id': { apiName: 'templateId', maxLength: 100 } },
    positionals: [{ name: 'id', optional: true, aliasFor: 'template-id', deprecated: true }],
    requiredOptions: ['template-id'],
  },
  {
    name: 'users clients create',
    method: 'POST',
    path: '/users/clients',
    body: {
      name: { apiName: 'name', maxLength: 200 },
      email: { apiName: 'email', format: 'email', maxLength: 320 },
    },
    requiredOptions: ['name', 'email'],
  },
  {
    name: 'users activity list',
    method: 'GET',
    path: '/users/activity',
    query: listQuery({
      search: { apiName: 'search', maxLength: 200 },
      action: { apiName: 'action', choices: ADMIN_ACTIONS },
      'start-date': { apiName: 'startDate', format: 'date' },
      'end-date': { apiName: 'endDate', format: 'date' },
    }, ['createdAt']),
    dateRange: { startOption: 'start-date', endOption: 'end-date', maxDays: 366 },
    pairedOptions: [['start-date', 'end-date']],
  },
  {
    name: 'users export',
    method: 'GET',
    path: '/users/export',
    query: { format: { apiName: 'format', choices: ['csv', 'json'] } },
    requiredOptions: ['format'],
  },
];
