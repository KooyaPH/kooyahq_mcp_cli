import assert from 'node:assert/strict';
import test from 'node:test';

import { parseTicketImport } from '../src/input/ticket-import.js';

test('parses frontend-compatible quoted CSV ticket rows', () => {
  const csv = [
    'title,ticketType,priority,points,tags,githubBranchName,githubStatus',
    '"Release, phase 1",task,high,3,"release, urgent",feature/release,pull-requested',
  ].join('\r\n');

  assert.deepEqual(
    parseTicketImport(Buffer.from(csv), 'csv', 5 * 1024 * 1024, 250),
    [{
      title: 'Release, phase 1',
      ticketType: 'task',
      priority: 'high',
      points: 3,
      tags: ['release', 'urgent'],
      github: { branchName: 'feature/release', status: 'pull-requested' },
    }],
  );
});

test('normalizes frontend-compatible flattened JSON ticket fields', () => {
  const rows = [{
    title: 'Release',
    ticketType: 'task',
    tags: 'release, urgent',
    relatedRefs: 'OPS-1, OPS-2',
    acceptanceCriteriaJson: '[{"text":"Verified"}]',
    documentsJson: '[{"url":"https://example.com/spec"}]',
    commentsJson: '[{"content":"Ready"}]',
    githubBranchName: 'feature/release',
    githubTargetBranch: 'main',
    githubPullRequestUrl: 'https://github.com/KooyaPH/repo/pull/1',
    githubStatus: 'pull-requested',
  }];

  assert.deepEqual(
    parseTicketImport(Buffer.from(JSON.stringify(rows)), 'json', 5 * 1024 * 1024, 250),
    [{
      title: 'Release',
      ticketType: 'task',
      tags: ['release', 'urgent'],
      relatedRefs: ['OPS-1', 'OPS-2'],
      acceptanceCriteria: [{ text: 'Verified' }],
      documents: [{ url: 'https://example.com/spec' }],
      comments: [{ content: 'Ready' }],
      github: {
        branchName: 'feature/release',
        targetBranch: 'main',
        pullRequestUrl: 'https://github.com/KooyaPH/repo/pull/1',
        status: 'pull-requested',
      },
    }],
  );
});

test('rejects CSV rows with more cells than the declared headers', () => {
  assert.throws(
    () => parseTicketImport(
      Buffer.from('title,ticketType\nRelease,task,unexpected'),
      'csv',
      5 * 1024 * 1024,
      250,
    ),
    /more values than headers/,
  );
});
