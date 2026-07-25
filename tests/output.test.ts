import assert from 'node:assert/strict';
import test from 'node:test';

import { formatOutput } from '../src/output/format.js';

test('prints explicit raw text without JSON quoting', () => {
  assert.equal(
    formatOutput('name,email\nUser,user@example.com', 'raw'),
    'name,email\nUser,user@example.com',
  );
});
