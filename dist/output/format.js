export function formatOutput(value, format) {
    if (format === 'raw') {
        if (typeof value === 'string')
            return value;
        return JSON.stringify(value ?? null);
    }
    if (format === 'json')
        return JSON.stringify(value ?? null, null, 2);
    if (format === 'ndjson') {
        const rows = extractNdjsonRows(value);
        return rows.map((row) => JSON.stringify(row ?? null)).join('\n');
    }
    if (value === undefined)
        return 'Success.';
    const rows = extractRows(value);
    if (rows.length === 0)
        return 'No results.';
    const records = rows.map(toRecord);
    const columns = [...new Set(records.flatMap((row) => Object.keys(row)))];
    const widths = columns.map((column) => Math.max(display(column).length, ...records.map((row) => display(row[column]).length)));
    const line = (row) => columns
        .map((column, index) => display(row[column]).padEnd(widths[index]))
        .join('  ')
        .trimEnd();
    return [
        line(Object.fromEntries(columns.map((column) => [column, column]))),
        widths.map((width) => '-'.repeat(width)).join('  '),
        ...records.map(line),
    ].join('\n');
}
function extractNdjsonRows(value) {
    if (value && typeof value === 'object') {
        const record = value;
        const data = record.data;
        if (data && typeof data === 'object' && !Array.isArray(data)) {
            const nested = data;
            if (Array.isArray(nested.events))
                return nested.events;
        }
    }
    return extractRows(value);
}
function extractRows(value) {
    if (Array.isArray(value))
        return value;
    if (value && typeof value === 'object') {
        const object = value;
        if (Array.isArray(object.data))
            return object.data;
    }
    return value === undefined ? [] : [value];
}
function toRecord(value) {
    if (value && typeof value === 'object' && !Array.isArray(value))
        return value;
    return { value };
}
function display(value) {
    if (value === undefined || value === null)
        return '';
    if (typeof value === 'object')
        return sanitizeTableText(JSON.stringify(value));
    return sanitizeTableText(String(value));
}
function sanitizeTableText(value) {
    return value.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ');
}
//# sourceMappingURL=format.js.map