export function formatOutput(value, format) {
    if (format === 'raw') {
        if (typeof value === 'string')
            return value;
        return JSON.stringify(value ?? null);
    }
    if (format === 'json')
        return JSON.stringify(value ?? null, null, 2);
    if (value === undefined)
        return 'Success.';
    const rows = extractRows(value);
    if (rows.length === 0)
        return 'No results.';
    const records = rows.map(toRecord);
    const columns = [...new Set(records.flatMap((row) => Object.keys(row)))];
    const widths = columns.map((column) => Math.max(column.length, ...records.map((row) => display(row[column]).length)));
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
        return JSON.stringify(value);
    return String(value);
}
//# sourceMappingURL=format.js.map