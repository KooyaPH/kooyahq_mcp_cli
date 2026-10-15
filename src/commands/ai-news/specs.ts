import type { CommandSpec } from '../types.js';

export const aiNewsCommands: CommandSpec[] = [
  {
    name: 'ai-news list',
    method: 'GET',
    path: '/ai-news',
    query: {
      filter: {
        apiName: 'filter',
        choices: [
          'all', 'news', 'custom', 'openai', 'techcrunch', 'google-ai', 'reddit',
          'reddit-artificial', 'hackernews', 'devto-ai', 'devto-ml', 'arxiv',
        ],
      },
      limit: { apiName: 'limit', type: 'integer', max: 100 },
      offset: { apiName: 'offset', type: 'integer', min: 0 },
    },
  },
  {
    name: 'ai-news create',
    method: 'POST',
    path: '/ai-news',
    body: {
      title: { apiName: 'title', maxLength: 300 },
      content: {
        apiName: 'content',
        maxLength: 20_000,
        description: 'Markdown body of the news item; it is also posted to the Feed.',
      },
      url: { apiName: 'url', format: 'https-url' },
      'image-url': { apiName: 'imageUrl', format: 'https-url' },
      author: { apiName: 'author' },
    },
    requiredOptions: ['title', 'content'],
  },
  {
    name: 'ai-news delete',
    method: 'DELETE',
    path: '/ai-news/:id',
    pathParams: { 'news-id': { apiName: 'id' } },
    requiredOptions: ['news-id'],
    confirmation: 'Delete AI news {news-id}? This also removes its Feed post.',
  },
];
