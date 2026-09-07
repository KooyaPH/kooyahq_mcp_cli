import type { CommandSpec, OptionSpec } from './types.js';

const MONGO_OBJECT_ID_EXAMPLE_FLAGS = new Set([
  'assignee-id',
  'budget-id',
  'comment-id',
  'entry-id',
  'notification-id',
  'project-id',
  'timer-id',
  'user-id',
]);

const DOMAIN_WORKFLOWS: Record<string, string> = {
  auth: 'Verify the configured access key before using protected resources.',
  projects: 'List or create projects, then use their IDs when tracking time or organizing work.',
  boards: 'Select a board by exact ID or key, inspect its members and settings, then make authorized changes.',
  tickets: 'Select a board, create or find a ticket, then use the ticket ID or key for lifecycle and detail actions.',
  time: 'Start one or more timers, pause or resume as needed, then stop timers or end the workday; team reads require server permission.',
  analytics: 'Choose the analytics view, supply its documented date range when required, and optionally narrow time analytics to an authorized user.',
  users: 'List users before assigning work; management actions require the corresponding server-side user permission.',
  notifications: 'List the current user notifications, inspect unread count, then mark individual or all notifications read.',
};

const VERB_SUMMARIES: Record<string, string> = {
  list: 'List',
  get: 'Get',
  create: 'Create',
  update: 'Update',
  delete: 'Delete',
  add: 'Add',
  remove: 'Remove',
  set: 'Set',
  clear: 'Clear',
  reset: 'Reset',
  move: 'Move',
  start: 'Start',
  'start-many': 'Start multiple',
  stop: 'Stop',
  'stop-all': 'Stop all',
  pause: 'Pause',
  resume: 'Resume',
  end: 'End',
  search: 'Search',
  assigned: 'List assigned',
  archive: 'Archive',
  unarchive: 'Unarchive',
  improve: 'Improve',
  'improve-draft': 'Improve a draft',
  preview: 'Preview',
  apply: 'Apply',
  favorite: 'Toggle favorite for',
  toggle: 'Toggle',
  count: 'Count',
  'mark-read': 'Mark one as read in',
  'mark-all-read': 'Mark all as read in',
  status: 'Get status for',
  summary: 'Summarize',
  today: 'List today\'s',
  costs: 'Get cost',
  team: 'Get team',
  projects: 'Get project',
  time: 'Get time',
  whoami: 'Show the authenticated user for',
};

export interface CommandDocumentation {
  summary: string;
  workflow: string;
  examples: string[];
}

export function commandDocumentation(command: CommandSpec): CommandDocumentation {
  return {
    summary: commandSummary(command),
    workflow: workflowFor(command.name.split(' ')[0]!),
    examples: commandExamples(command),
  };
}

export function commandSummary(command: CommandSpec): string {
  if (command.name === 'tickets improve') return 'Preview AI improvement suggestions for a ticket.';
  if (command.name === 'tickets improve-draft') {
    return 'Preview AI improvement suggestions for a ticket draft.';
  }
  const tokens = command.name.split(' ');
  const action = tokens.at(-1)!;
  const subject = tokens.slice(0, -1).join(' ');
  const verb = VERB_SUMMARIES[action]
    ?? (command.method === 'GET' ? 'Get' : command.method === 'DELETE' ? 'Delete' : 'Change');
  return `${verb} ${humanize(subject)}.`.replace(/\s+/g, ' ');
}

export function workflowFor(scope: string): string {
  return DOMAIN_WORKFLOWS[scope]
    ?? 'Inspect the resource first, then make the smallest authorized change and verify the result.';
}

export function commandExamples(command: CommandSpec): string[] {
  const options = new Map<string, OptionSpec>();
  Object.entries(command.pathParams ?? {}).forEach(([name, spec]) => options.set(name, spec));
  Object.entries(command.query ?? {}).forEach(([name, spec]) => options.set(name, spec));
  Object.entries(command.body ?? {}).forEach(([name, spec]) => options.set(name, spec));

  const selected = new Set(command.requiredOptions ?? []);
  for (const group of command.exactlyOne ?? []) selected.add(group[0]!);
  for (const group of command.atLeastOne ?? []) selected.add(group[0]!);
  if (command.requireBody && ![...selected].some((name) => command.body?.[name])) {
    const firstBody = Object.keys(command.body ?? {})[0];
    if (firstBody) selected.add(firstBody);
  }

  const parts = ['kooyahq', command.name];
  for (const positional of command.positionals ?? []) {
    if (!positional.optional && !positional.deprecated) parts.push(sampleFor(positional.name, {}));
  }
  for (const name of selected) {
    const spec = options.get(name);
    if (!spec) continue;
    parts.push(`--${name}`);
    if (spec.type !== 'switch') parts.push(sampleFor(name, spec));
  }
  if (command.fileInput) parts.push('--file', 'tickets.json');
  const invocation = parts.join(' ');
  if (command.name === 'users permissions update') {
    return [`${invocation} --dry-run --output json`];
  }
  return command.method === 'GET'
    ? [invocation, `${invocation} --output json`]
    : [`${invocation} --dry-run --output json`, invocation];
}

export function optionDescription(name: string, location: 'path' | 'query' | 'body' | 'input'): string {
  const descriptions: Record<string, string> = {
    page: 'One-based result page to request.',
    limit: 'Maximum results to return per page.',
    sort: 'Allowlisted response field used to sort results.',
    order: 'Sort direction used with --sort.',
    search: 'Text used to narrow matching results.',
    'start-date': 'Inclusive calendar-date lower bound.',
    'end-date': 'Inclusive calendar-date upper bound.',
    'start-time': 'ISO 8601 timestamp when tracked work started.',
    'end-time': 'ISO 8601 timestamp when tracked work ended.',
    file: 'Path to the bounded ticket import file.',
    stdin: 'Read the bounded ticket import payload from standard input.',
    format: 'Input or output representation accepted by this command.',
    direction: 'Blocker relationship direction; defaults to all.',
    permissions: 'Comma-separated permissions from the current backend catalog; discover templates with `kooyahq users templates list --output json`.',
    'operation-id': 'Retry-safe identifier for this import. Reuse it only with the exact same payload.',
  };
  if (descriptions[name]) return descriptions[name]!;
  if (name.endsWith('-id')) return `Exact ${humanize(name.slice(0, -3))} identifier.`;
  if (name.endsWith('-key')) return `Exact ${humanize(name.slice(0, -4))} key.`;
  if (name.endsWith('-ids')) return `Comma-separated exact ${humanize(name.slice(0, -4))} identifiers.`;
  const action = location === 'query' ? 'Filter or request value' : location === 'body' ? 'Request field' : 'Resource selector';
  return `${action} for ${humanize(name)}.`;
}

export function optionValueLabel(spec: OptionSpec): string {
  if (spec.type === 'switch') return '';
  if (spec.choices?.length) return `<${spec.choices.join('|')}>`;
  if (spec.numericChoices?.length) return `<${spec.numericChoices.join('|')}>`;
  if (spec.format === 'date') return '<YYYY-MM-DD>';
  if (spec.format === 'datetime') return '<ISO-8601>';
  if (spec.format === 'https-url') return '<https-url>';
  if (spec.format === 'hex-color') return '<#RRGGBB>';
  if (spec.format === 'email') return '<email>';
  if (spec.format === 'board-key') return '<BOARD>';
  if (spec.format === 'ticket-key') return '<BOARD-123>';
  if (spec.format === 'object-id') return '<object-id>';
  if (spec.format === 'uuid') return '<uuid>';
  if (spec.type === 'integer') return '<integer>';
  if (spec.type === 'number') return '<number>';
  if (spec.type === 'boolean') return '<true|false>';
  if (spec.type === 'csv') return '<value,...>';
  if (spec.type === 'json-object') return '<json-object>';
  if (spec.type === 'json-array') return '<json-array>';
  return '<value>';
}

export function optionConstraints(spec: OptionSpec): string[] {
  return [
    ...(spec.choices?.length ? [`enum: ${spec.choices.join(', ')}`] : []),
    ...(spec.numericChoices?.length ? [`enum: ${spec.numericChoices.join(', ')}`] : []),
    ...(spec.itemChoices?.length ? [`item enum: ${spec.itemChoices.join(', ')}`] : []),
    ...(spec.format ? [`format: ${spec.format}`] : []),
    ...(spec.min !== undefined ? [`min: ${spec.min}`] : []),
    ...(spec.max !== undefined ? [`max: ${spec.max}`] : []),
    ...(spec.maxLength !== undefined ? [`max length: ${spec.maxLength}`] : []),
    ...(spec.maxItems !== undefined ? [`max items: ${spec.maxItems}`] : []),
    ...(spec.uniqueItems ? ['unique values'] : []),
    ...(spec.caseInsensitiveUniqueItems ? ['case-insensitive unique values'] : []),
    ...(spec.itemMaxLength !== undefined ? [`item max length: ${spec.itemMaxLength}`] : []),
    ...(spec.pattern ? [`pattern: ${spec.patternDescription ?? spec.pattern}`] : []),
    ...(spec.jsonNumericOrder?.length
      ? spec.jsonNumericOrder.map(({ lower, upper }) => `${lower} must not exceed ${upper}`)
      : []),
    ...(spec.jsonSchema ? [`JSON schema: ${JSON.stringify(spec.jsonSchema)}`] : []),
    ...(spec.example ? [`example: ${spec.example}`] : []),
  ];
}

function sampleFor(name: string, spec: Partial<OptionSpec>): string {
  if (spec.example) return shellQuote(spec.example);
  if (spec.choices?.length) return spec.choices[0]!;
  if (spec.numericChoices?.length) return String(spec.numericChoices[0]!);
  if (spec.format === 'date') return '2026-07-25';
  if (spec.format === 'datetime') return '2026-07-25T09:00:00+08:00';
  if (spec.format === 'https-url') return 'https://example.com';
  if (spec.format === 'hex-color') return '#2563eb';
  if (spec.format === 'email') return 'user@example.com';
  if (spec.format === 'board-key') return 'OPS';
  if (spec.format === 'ticket-key') return 'OPS-42';
  if (spec.format === 'object-id') return '507f1f77bcf86cd799439011';
  if (spec.format === 'uuid') return '123e4567-e89b-42d3-a456-426614174000';
  if (spec.type === 'boolean') return 'true';
  if (spec.type === 'integer' || spec.type === 'number') return String(Math.max(1, spec.min ?? 1));
  if (spec.type === 'json-object') return "'{}'";
  if (spec.type === 'json-array') return "'[]'";
  if (spec.type === 'csv') {
    if (name === 'projects') return 'Project-A,Project-B';
    if (spec.itemChoices?.length) {
      const preferred = ['projects:view', 'board:view']
        .filter((value) => spec.itemChoices!.includes(value));
      return (preferred.length > 0 ? preferred : spec.itemChoices.slice(0, 2)).join(',');
    }
    return 'value-1,value-2';
  }
  if (name.endsWith('-date')) return '2026-07-25';
  if (name === 'title') return '"Example ticket"';
  if (name === 'name') return '"Example"';
  if (name === 'email') return 'user@example.com';
  if (name === 'board-key') return 'OPS';
  if (name === 'ticket-key' || name.endsWith('-ticket-key')) return 'OPS-42';
  if (MONGO_OBJECT_ID_EXAMPLE_FLAGS.has(name)) return '507f1f77bcf86cd799439011';
  if (name.endsWith('-id')) return `${name.slice(0, -3).replace(/-/g, '_')}_123`;
  if (name.endsWith('-key')) return `${name.slice(0, -4).replace(/-/g, '_')}_key`;
  if (name === 'id') return 'resource_123';
  return 'example-value';
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function humanize(value: string): string {
  return value.replace(/-/g, ' ');
}
