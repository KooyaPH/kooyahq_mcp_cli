import { ValidationError } from '../core/errors.js';
const CSV_HEADERS = new Set([
    'importRef', 'title', 'ticketType', 'status', 'priority', 'reporterEmail', 'assigneeEmail',
    'points', 'tags', 'parentRef', 'rootEpicRef', 'startDate', 'endDate', 'dueDate',
    'description', 'acceptanceCriteriaJson', 'documentsJson', 'commentsJson', 'relatedRefs',
    'githubBranchName', 'githubTargetBranch', 'githubPullRequestUrl', 'githubStatus',
]);
export function parseTicketImport(bytes, format, maxBytes, maxItems) {
    if (bytes.byteLength > maxBytes) {
        throw new ValidationError(`Import input exceeds the ${maxBytes} byte limit.`);
    }
    let text;
    try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    }
    catch {
        throw new ValidationError('Ticket import file must contain valid UTF-8 text.');
    }
    const value = format === 'json' ? parseJson(text) : parseCsv(text);
    const rows = validateRows(value, maxItems);
    return format === 'json' ? rows.map(normalizeJsonRow) : rows;
}
function parseJson(text) {
    try {
        return JSON.parse(text);
    }
    catch {
        throw new ValidationError('Ticket import file must contain valid JSON.');
    }
}
function validateRows(value, maxItems) {
    if (!Array.isArray(value))
        throw new ValidationError('Ticket import JSON must be an array.');
    if (value.length === 0)
        throw new ValidationError('Ticket import must contain at least one ticket.');
    if (value.length > maxItems) {
        throw new ValidationError(`Ticket import exceeds the ${maxItems} ticket limit.`);
    }
    if (value.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
        throw new ValidationError('Every imported ticket must be a JSON object.');
    }
    return value;
}
function parseCsv(text) {
    const records = parseCsvRecords(text.trim());
    if (records.length < 2) {
        throw new ValidationError('Ticket import CSV requires a header and at least one data row.');
    }
    const headers = records[0].map((header) => header.trim());
    if (new Set(headers).size !== headers.length) {
        throw new ValidationError('Ticket import CSV headers must be unique.');
    }
    const unknown = headers.filter((header) => !CSV_HEADERS.has(header));
    if (unknown.length > 0) {
        throw new ValidationError(`Unknown ticket import CSV header: ${unknown[0]}.`);
    }
    const oversized = records.slice(1).find((record) => record.length > headers.length);
    if (oversized) {
        throw new ValidationError('Ticket import CSV row has more values than headers.');
    }
    return records.slice(1).map((record) => normalizeCsvRow(headers, record));
}
function normalizeJsonRow(input) {
    const row = { ...input };
    if (typeof row.tags === 'string')
        row.tags = splitList(row.tags);
    if (typeof row.relatedRefs === 'string')
        row.relatedRefs = splitList(row.relatedRefs);
    normalizeJsonArrayField(row, 'acceptanceCriteriaJson', 'acceptanceCriteria');
    normalizeJsonArrayField(row, 'documentsJson', 'documents');
    normalizeJsonArrayField(row, 'commentsJson', 'comments');
    const flattenedGithub = {};
    const mappings = [
        ['githubBranchName', 'branchName'],
        ['githubTargetBranch', 'targetBranch'],
        ['githubPullRequestUrl', 'pullRequestUrl'],
        ['githubStatus', 'status'],
    ];
    for (const [source, target] of mappings) {
        if (row[source] !== undefined && row[source] !== '')
            flattenedGithub[target] = row[source];
        delete row[source];
    }
    if (Object.keys(flattenedGithub).length > 0) {
        if (row.github !== undefined && (!row.github || typeof row.github !== 'object' || Array.isArray(row.github))) {
            throw new ValidationError('Ticket import JSON field github must be an object.');
        }
        row.github = { ...row.github, ...flattenedGithub };
    }
    return row;
}
function normalizeJsonArrayField(row, source, target) {
    const value = row[source];
    if (value === undefined || value === '')
        return;
    if (row[target] !== undefined) {
        throw new ValidationError(`Ticket import JSON must not combine ${source} with ${target}.`);
    }
    let parsed = value;
    if (typeof value === 'string') {
        try {
            parsed = JSON.parse(value);
        }
        catch {
            throw new ValidationError(`Ticket import JSON field ${source} must contain valid JSON.`);
        }
    }
    if (!Array.isArray(parsed)) {
        throw new ValidationError(`Ticket import JSON field ${source} must contain a JSON array.`);
    }
    row[target] = parsed;
    delete row[source];
}
function parseCsvRecords(text) {
    const records = [];
    let row = [];
    let cell = '';
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        const next = text[index + 1];
        if (character === '"') {
            if (quoted && next === '"') {
                cell += '"';
                index += 1;
            }
            else {
                quoted = !quoted;
            }
            continue;
        }
        if (character === ',' && !quoted) {
            row.push(cell);
            cell = '';
            continue;
        }
        if ((character === '\n' || character === '\r') && !quoted) {
            if (character === '\r' && next === '\n')
                index += 1;
            row.push(cell);
            if (row.some((value) => value.trim()))
                records.push(row);
            row = [];
            cell = '';
            continue;
        }
        cell += character;
    }
    if (quoted)
        throw new ValidationError('Ticket import CSV contains an unclosed quoted field.');
    row.push(cell);
    if (row.some((value) => value.trim()))
        records.push(row);
    return records;
}
function normalizeCsvRow(headers, record) {
    const cells = Object.fromEntries(headers.map((header, index) => [header, record[index]?.trim() ?? '']));
    const row = {};
    const simpleFields = [
        'importRef', 'title', 'ticketType', 'status', 'priority', 'reporterEmail', 'assigneeEmail',
        'parentRef', 'rootEpicRef', 'startDate', 'endDate', 'dueDate', 'description',
    ];
    for (const field of simpleFields) {
        if (cells[field])
            row[field] = cells[field];
    }
    if (cells.points) {
        const points = Number(cells.points);
        row.points = Number.isFinite(points) ? points : cells.points;
    }
    if (cells.tags)
        row.tags = splitList(cells.tags);
    if (cells.relatedRefs)
        row.relatedRefs = splitList(cells.relatedRefs);
    assignJsonArray(row, 'acceptanceCriteria', cells.acceptanceCriteriaJson);
    assignJsonArray(row, 'documents', cells.documentsJson);
    assignJsonArray(row, 'comments', cells.commentsJson);
    const github = {
        ...(cells.githubBranchName ? { branchName: cells.githubBranchName } : {}),
        ...(cells.githubTargetBranch ? { targetBranch: cells.githubTargetBranch } : {}),
        ...(cells.githubPullRequestUrl ? { pullRequestUrl: cells.githubPullRequestUrl } : {}),
        ...(cells.githubStatus ? { status: cells.githubStatus } : {}),
    };
    if (Object.keys(github).length > 0)
        row.github = github;
    return row;
}
function splitList(value) {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
}
function assignJsonArray(row, field, value) {
    if (!value)
        return;
    let parsed;
    try {
        parsed = JSON.parse(value);
    }
    catch {
        throw new ValidationError(`Ticket import CSV field ${field} must contain valid JSON.`);
    }
    if (!Array.isArray(parsed)) {
        throw new ValidationError(`Ticket import CSV field ${field} must contain a JSON array.`);
    }
    row[field] = parsed;
}
//# sourceMappingURL=ticket-import.js.map