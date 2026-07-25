const DOMAIN_WORKFLOWS = {
    auth: 'Verify the configured access key before using protected resources.',
    projects: 'List or create projects, then use their IDs when tracking time or organizing work.',
    boards: 'Select a board by exact ID or key, inspect its members and settings, then make authorized changes.',
    tickets: 'Select a board, create or find a ticket, then use the ticket ID or key for lifecycle and detail actions.',
    time: 'Start one or more timers, pause or resume as needed, then stop timers or end the workday; team reads require server permission.',
    analytics: 'Choose an explicit date range, optionally narrow to an authorized user, then request the required analytics view.',
    users: 'List users before assigning work; management actions require the corresponding server-side user permission.',
    notifications: 'List the current user notifications, inspect unread count, then mark individual or all notifications read.',
};
const VERB_SUMMARIES = {
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
export function commandDocumentation(command) {
    return {
        summary: commandSummary(command),
        workflow: workflowFor(command.name.split(' ')[0]),
        examples: commandExamples(command),
    };
}
export function commandSummary(command) {
    const tokens = command.name.split(' ');
    const action = tokens.at(-1);
    const subject = tokens.slice(0, -1).join(' ');
    const verb = VERB_SUMMARIES[action]
        ?? (command.method === 'GET' ? 'Get' : command.method === 'DELETE' ? 'Delete' : 'Change');
    return `${verb} ${humanize(subject)}.`.replace(/\s+/g, ' ');
}
export function workflowFor(scope) {
    return DOMAIN_WORKFLOWS[scope]
        ?? 'Inspect the resource first, then make the smallest authorized change and verify the result.';
}
export function commandExamples(command) {
    const options = new Map();
    Object.entries(command.pathParams ?? {}).forEach(([name, spec]) => options.set(name, spec));
    Object.entries(command.query ?? {}).forEach(([name, spec]) => options.set(name, spec));
    Object.entries(command.body ?? {}).forEach(([name, spec]) => options.set(name, spec));
    const selected = new Set(command.requiredOptions ?? []);
    for (const group of command.exactlyOne ?? [])
        selected.add(group[0]);
    if (command.requireBody && ![...selected].some((name) => command.body?.[name])) {
        const firstBody = Object.keys(command.body ?? {})[0];
        if (firstBody)
            selected.add(firstBody);
    }
    const parts = ['kooyahq', command.name];
    for (const positional of command.positionals ?? []) {
        if (!positional.optional && !positional.deprecated)
            parts.push(sampleFor(positional.name, {}));
    }
    for (const name of selected) {
        const spec = options.get(name);
        if (!spec)
            continue;
        parts.push(`--${name}`);
        if (spec.type !== 'switch')
            parts.push(sampleFor(name, spec));
    }
    const invocation = parts.join(' ');
    return command.method === 'GET'
        ? [invocation, `${invocation} --output json`]
        : [`${invocation} --dry-run --output json`, invocation];
}
export function optionValueLabel(spec) {
    if (spec.type === 'switch')
        return '';
    if (spec.choices?.length)
        return `<${spec.choices.join('|')}>`;
    if (spec.numericChoices?.length)
        return `<${spec.numericChoices.join('|')}>`;
    if (spec.format === 'date')
        return '<YYYY-MM-DD>';
    if (spec.format === 'datetime')
        return '<ISO-8601>';
    if (spec.format === 'https-url')
        return '<https-url>';
    if (spec.format === 'hex-color')
        return '<#RRGGBB>';
    if (spec.format === 'email')
        return '<email>';
    if (spec.format === 'board-key')
        return '<BOARD>';
    if (spec.format === 'ticket-key')
        return '<BOARD-123>';
    if (spec.type === 'integer')
        return '<integer>';
    if (spec.type === 'number')
        return '<number>';
    if (spec.type === 'boolean')
        return '<true|false>';
    if (spec.type === 'csv')
        return '<value,...>';
    if (spec.type === 'json-object')
        return '<json-object>';
    if (spec.type === 'json-array')
        return '<json-array>';
    return '<value>';
}
export function optionConstraints(spec) {
    return [
        ...(spec.choices?.length ? [`enum: ${spec.choices.join(', ')}`] : []),
        ...(spec.numericChoices?.length ? [`enum: ${spec.numericChoices.join(', ')}`] : []),
        ...(spec.format ? [`format: ${spec.format}`] : []),
        ...(spec.min !== undefined ? [`min: ${spec.min}`] : []),
        ...(spec.max !== undefined ? [`max: ${spec.max}`] : []),
        ...(spec.maxLength !== undefined ? [`max length: ${spec.maxLength}`] : []),
        ...(spec.maxItems !== undefined ? [`max items: ${spec.maxItems}`] : []),
        ...(spec.uniqueItems ? ['unique values'] : []),
    ];
}
function sampleFor(name, spec) {
    if (spec.choices?.length)
        return spec.choices[0];
    if (spec.numericChoices?.length)
        return String(spec.numericChoices[0]);
    if (spec.format === 'date')
        return '2026-07-25';
    if (spec.format === 'datetime')
        return '2026-07-25T09:00:00+08:00';
    if (spec.format === 'https-url')
        return 'https://example.com';
    if (spec.format === 'hex-color')
        return '#2563eb';
    if (spec.type === 'boolean')
        return 'true';
    if (spec.type === 'integer' || spec.type === 'number')
        return String(Math.max(1, spec.min ?? 1));
    if (spec.type === 'json-object')
        return "'{}'";
    if (spec.type === 'json-array')
        return "'[]'";
    if (spec.type === 'csv')
        return 'value-1,value-2';
    if (name.endsWith('-date'))
        return '2026-07-25';
    if (name === 'title')
        return '"Example ticket"';
    if (name === 'name')
        return '"Example"';
    if (name === 'email')
        return 'user@example.com';
    return `<${name}>`;
}
function humanize(value) {
    return value.replace(/-/g, ' ');
}
//# sourceMappingURL=documentation.js.map