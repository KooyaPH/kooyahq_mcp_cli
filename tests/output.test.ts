import assert from 'node:assert/strict';
import test from 'node:test';

import { formatOutput } from '../src/output/format.js';

test('prints explicit raw text without JSON quoting', () => {
  assert.equal(
    formatOutput('name,email\nUser,user@example.com', 'raw'),
    'name,email\nUser,user@example.com',
  );
});

test('removes terminal control characters from table cells and headers only', () => {
  const value = [{ 'na\u001bme': 'safe\u001b]52;c;copied\u0007\nnext' }];
  const table = formatOutput(value, 'table');

  assert.doesNotMatch(table, /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/);
  assert.match(table, /safe.*next/);
  assert.equal(formatOutput('safe\u001b]52;c;copied\u0007', 'raw'), 'safe\u001b]52;c;copied\u0007');
});
