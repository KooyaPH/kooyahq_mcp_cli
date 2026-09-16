import type { CommandSpec } from '../types.js';

export const announcementCommands: CommandSpec[] = [
  {
    name: 'announcements list',
    method: 'GET',
    path: '/announcements',
    query: {
      'only-active': { apiName: 'onlyActive', type: 'boolean' },
    },
  },
  {
    name: 'announcements get',
    method: 'GET',
    path: '/announcements/:announcementId',
    pathParams: { 'announcement-id': { apiName: 'announcementId', format: 'object-id' } },
    requiredOptions: ['announcement-id'],
  },
  {
    name: 'announcements create',
    method: 'POST',
    path: '/announcements',
    body: {
      title: { apiName: 'title', maxLength: 200 },
      content: { apiName: 'content', maxLength: 50_000 },
      'is-active': { apiName: 'isActive', type: 'boolean' },
      'expires-at': { apiName: 'expiresAt', format: 'datetime' },
    },
    requiredOptions: ['title', 'content'],
  },
  {
    name: 'announcements update',
    method: 'PATCH',
    path: '/announcements/:announcementId',
    pathParams: { 'announcement-id': { apiName: 'announcementId', format: 'object-id' } },
    requiredOptions: ['announcement-id'],
    body: {
      title: { apiName: 'title', maxLength: 200 },
      content: { apiName: 'content', maxLength: 50_000 },
      'is-active': { apiName: 'isActive', type: 'boolean' },
      'expires-at': { apiName: 'expiresAt', format: 'datetime' },
    },
    requireBody: true,
  },
  {
    name: 'announcements delete',
    method: 'DELETE',
    path: '/announcements/:announcementId',
    pathParams: { 'announcement-id': { apiName: 'announcementId', format: 'object-id' } },
    requiredOptions: ['announcement-id'],
    confirmation: 'Delete announcement {announcement-id}?',
  },
];
