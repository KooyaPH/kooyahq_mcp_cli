import assert from 'node:assert/strict';
import test from 'node:test';

import { commandCatalog } from '../src/commands/catalog.js';
import { commandExamples } from '../src/commands/documentation.js';
import { helpText } from '../src/runtime/help.js';
import { skillOutput } from '../src/runtime/skill.js';

test('generated examples are shell-safe and import examples include a usable input source', () => {
  for (const command of commandCatalog) {
    const examples = commandExamples(command);
    assert.ok(examples.length > 0, `${command.name} must have an example`);
    for (const example of examples) {
      assert.doesNotMatch(example, /[<>]/, `${command.name} uses a shell redirection character`);
      if (command.fileInput) {
        assert.match(example, /--(?:file|stdin)(?:\s|$)/, `${command.name} omits its input source`);
      }
    }
  }
});

test('JSON command skills describe every parameter and model exactly-one groups truthfully', () => {
  const create = JSON.parse(skillOutput(['tickets', 'create', '--output', 'json'])) as {
    schemaVersion: number;
    parameters: Array<{ name: string; required: boolean; description?: string }>;
    exactlyOne: string[][];
  };

  assert.equal(create.schemaVersion, 2);
  assert.ok(create.parameters.every((parameter) => Boolean(parameter.description)));
  assert.deepEqual(create.exactlyOne[0], ['board-id', 'board-key']);
  assert.equal(create.parameters.find((parameter) => parameter.name === 'board-id')?.required, false);

  const ticketImport = JSON.parse(
    skillOutput(['tickets', 'import', 'preview', '--output', 'json']),
  ) as {
    exactlyOne: string[][];
    input?: {
      formats: string[];
      jsonShape: string;
      maxBytes: number;
      maxItems: number;
      rowFields: Array<{ name: string; type: string }>;
      csvHeaders: string[];
    };
  };

  assert.ok(ticketImport.exactlyOne.some((group) => group.join(',') === 'file,stdin'));
  assert.deepEqual(ticketImport.input?.formats, ['json', 'csv']);
  assert.equal(ticketImport.input?.jsonShape, 'array');
  assert.equal(ticketImport.input?.maxBytes, 5 * 1024 * 1024);
  assert.equal(ticketImport.input?.maxItems, 250);
  assert.ok(ticketImport.input?.rowFields.some((field) => field.name === 'title' && field.type === 'string'));
  assert.ok(ticketImport.input?.csvHeaders.includes('acceptanceCriteriaJson'));
});

test('blocker-list skill documents its directional response envelope', () => {
  const blockers = JSON.parse(
    skillOutput(['tickets', 'blockers', 'list', '--output', 'json']),
  ) as { response?: { description?: string; fields?: string[] } };

  assert.match(blockers.response?.description ?? '', /blockedBy.*blocking/);
  assert.deepEqual(blockers.response?.fields, ['blockedBy', 'blocking']);
});

test('JSON skills expose date and timestamp range constraints', () => {
  const comparison = JSON.parse(
    skillOutput(['analytics', 'costs', 'compare', '--output', 'json']),
  ) as { dateRanges?: Array<{ startOption: string; endOption: string; maxDays: number }> };
  assert.deepEqual(comparison.dateRanges, [
    { startOption: 'current-start', endOption: 'current-end', maxDays: 366 },
    { startOption: 'previous-start', endOption: 'previous-end', maxDays: 366 },
  ]);

  const timeEntry = JSON.parse(
    skillOutput(['time', 'entries', 'create', '--output', 'json']),
  ) as { dateTimeRanges?: Array<{ startOption: string; endOption: string }> };
  assert.deepEqual(timeEntry.dateTimeRanges, [
    { startOption: 'start-time', endOption: 'end-time' },
  ]);
});

test('every JSON option has structured schema, example metadata, and useful help', () => {
  for (const command of commandCatalog) {
    const definitions = { ...command.pathParams, ...command.query, ...command.body };
    const jsonOptions = Object.entries(definitions)
      .filter(([, definition]) => definition.type === 'json-object' || definition.type === 'json-array');
    if (jsonOptions.length === 0) continue;

    const skill = JSON.parse(skillOutput([...command.name.split(' '), '--output', 'json'])) as {
      parameters: Array<{ name: string; jsonSchema?: unknown; example?: unknown }>;
    };
    const help = helpText(command.name.split(' '));
    for (const [name, definition] of jsonOptions) {
      assert.ok(definition.jsonSchema, `${command.name} --${name} is missing jsonSchema`);
      assert.ok(definition.example, `${command.name} --${name} is missing an example`);
      const parameter = skill.parameters.find((candidate) => candidate.name === name);
      assert.deepEqual(parameter?.jsonSchema, definition.jsonSchema);
      assert.equal(parameter?.example, definition.example);
      assert.match(help, new RegExp(`--${name}`));
      assert.match(help, new RegExp(escapeRegExp(String(definition.example))));
    }
  }
  assert.equal(
    commandCatalog.some((command) => Boolean(command.body?.['draft-json'])),
    false,
  );
});

test('permission mutation discovery is safe and points to current templates', () => {
  const document = JSON.parse(
    skillOutput(['users', 'permissions', 'update', '--output', 'json']),
  ) as {
    examples: string[];
    parameters: Array<{ name: string; description?: string; itemChoices?: string[] }>;
  };
  const permissions = document.parameters.find((parameter) => parameter.name === 'permissions');
  assert.ok(permissions?.itemChoices?.includes('users:view'));
  assert.match(permissions?.description ?? '', /users templates list/);
  assert.ok(document.examples.every((example) => example.includes('--dry-run')));
  assert.ok(document.examples.some((example) => example.includes('users:view')));
  assert.doesNotMatch(helpText(['users', 'permissions', 'update']), /projects\.read/);
  assert.match(helpText(['users', 'permissions', 'update']), /users templates list/);
});

test('subtask parent dependency is machine-readable and visible in help', () => {
  const document = JSON.parse(skillOutput(['tickets', 'create', '--output', 'json'])) as {
    conditionalExactlyOne?: unknown[];
  };
  assert.deepEqual(document.conditionalExactlyOne, [{
    when: { option: 'ticket-type', value: 'subtask' },
    options: ['parent-ticket-id', 'parent-ticket-key'],
  }]);
  assert.match(helpText(['tickets', 'create']), /When --ticket-type is subtask.*exactly one.*--parent-ticket-id.*--parent-ticket-key/i);
});

test('rejects repeated skill output options', () => {
  assert.throws(
    () => skillOutput(['tickets', 'create', '--output', 'json', '--output=json']),
    /--skill --output must not be repeated/,
  );
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
