import type { CommandSpec } from '../types.js';

const IMAGE_MAX = 5 * 1024 * 1024;

export const settingsCommands: CommandSpec[] = [
  { name: 'settings theme get', method: 'GET', path: '/settings/theme' },
  {
    name: 'settings theme set',
    method: 'PUT',
    path: '/settings/theme',
    body: {
      light: {
        apiName: 'light',
        type: 'json-object',
        jsonSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            primary: { type: 'string' },
            secondary: { type: 'string' },
            accent: { type: 'string' },
            destructive: { type: 'string' },
            muted: { type: 'string' },
            background: { type: 'string' },
            foreground: { type: 'string' },
            border: { type: 'string' },
          },
        },
        example: '{"primary":"#2563eb","secondary":"#64748b","accent":"#0ea5e9","destructive":"#dc2626","muted":"#f1f5f9","background":"#ffffff","foreground":"#0f172a","border":"#e2e8f0"}',
      },
      dark: {
        apiName: 'dark',
        type: 'json-object',
        jsonSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            primary: { type: 'string' },
            secondary: { type: 'string' },
            accent: { type: 'string' },
            destructive: { type: 'string' },
            muted: { type: 'string' },
            background: { type: 'string' },
            foreground: { type: 'string' },
            border: { type: 'string' },
          },
        },
        example: '{"primary":"#3b82f6","secondary":"#94a3b8","accent":"#38bdf8","destructive":"#f87171","muted":"#1e293b","background":"#020617","foreground":"#f8fafc","border":"#334155"}',
      },
    },
    atLeastOne: [['light', 'dark']],
  },
  {
    name: 'settings theme mandatory set',
    method: 'PUT',
    path: '/settings/theme/mandatory',
    body: {
      mandatory: { apiName: 'themeMandatory', type: 'boolean' },
    },
    requiredOptions: ['mandatory'],
  },
  { name: 'settings preferences get', method: 'GET', path: '/users/preferences' },
  {
    name: 'settings preferences set',
    method: 'PUT',
    path: '/users/preferences',
    body: {
      'theme-colors': {
        apiName: 'themeColors',
        type: 'json-object',
        jsonSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            light: { type: ['string', 'null'] },
            dark: { type: ['string', 'null'] },
          },
        },
        example: '{"light":"#2563eb","dark":"#3b82f6"}',
      },
      'font-size': { apiName: 'fontSize', choices: ['small', 'medium', 'large'] },
      'sidebar-collapsed': { apiName: 'sidebarCollapsed', type: 'boolean' },
    },
    requireBody: true,
  },
  { name: 'settings profile get', method: 'GET', path: '/users/profile' },
  {
    name: 'settings profile update',
    method: 'PUT',
    path: '/users/profile',
    body: {
      bio: { apiName: 'bio', maxLength: 2000 },
      status: { apiName: 'status', choices: ['online', 'busy', 'away', 'offline'] },
    },
    multipartFiles: [
      { flag: 'profile-pic', fieldName: 'profilePic', maxBytes: IMAGE_MAX },
      { flag: 'banner', fieldName: 'banner', maxBytes: IMAGE_MAX },
    ],
    atLeastOne: [['bio', 'status', 'profile-pic', 'banner']],
  },
];
