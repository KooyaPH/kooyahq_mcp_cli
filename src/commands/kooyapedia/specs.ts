import type { CommandSpec } from '../types.js';

export const kooyapediaCommands: CommandSpec[] = [
  { name: 'kooyapedia home', method: 'GET', path: '/kooyapedia/home' },
  {
    name: 'kooyapedia search',
    method: 'GET',
    path: '/kooyapedia/search',
    query: { q: { apiName: 'q', maxLength: 200 } },
    requiredOptions: ['q'],
  },
  {
    name: 'kooyapedia suggest',
    method: 'GET',
    path: '/kooyapedia/suggest',
    query: { q: { apiName: 'q', maxLength: 100 } },
    requiredOptions: ['q'],
  },
  {
    name: 'kooyapedia pages list',
    method: 'GET',
    path: '/kooyapedia/pages',
    query: {
      project: { apiName: 'project', maxLength: 200 },
      space: { apiName: 'space', maxLength: 200 },
    },
  },
  {
    name: 'kooyapedia pages get',
    method: 'GET',
    path: '/kooyapedia/pages/:slug',
    pathParams: {
      slug: {
        apiName: 'slug',
        pattern: '^[a-z0-9][a-z0-9-]{0,199}$',
        patternDescription: 'a lowercase hyphenated wiki slug',
      },
    },
    requiredOptions: ['slug'],
  },
];
