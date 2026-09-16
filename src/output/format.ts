import type { OutputFormat } from '../commands/types.js';

export function formatOutput(value: unknown, format: OutputFormat): string {
  if (format === 'raw') {
    if (typeof value === 'string') return value;
    return JSON.stringify(value ?? null);
  }
  if (format === 'json') return JSON.stringify(value ?? null, null, 2);
  if (format === 'ndjson') {
    const rows = extractNdjsonRows(value);
    return rows.map((row) => JSON.stringify(row ?? null)).join('\n');
  }
  if (value === undefined) return 'Success.';
  const rows = extractRows(value);
  if (rows.length === 0) return 'No results.';
  const records = rows.map(toRecord);
  const columns = [...new Set(records.flatMap((row) => Object.keys(row)))];
  const widths = columns.map((column) => Math.max(
    display(column).length,
    ...records.map((row) => display(row[column]).length),
  ));
  const line = (row: Record<string, unknown>) => columns
    .map((column, index) => display(row[column]).padEnd(widths[index]!))
    .join('  ')
    .trimEnd();
  return [
    line(Object.fromEntries(columns.map((column) => [column, column]))),
    widths.map((width) => '-'.repeat(width)).join('  '),
    ...records.map(line),
  ].join('\n');
}

function extractNdjsonRows(value: unknown): unknown[] {
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const data = record.data;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const nested = data as Record<string, unknown>;
      if (Array.isArray(nested.events)) return nested.events;
    }
  }
  return extractRows(value);
}

function extractRows(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    if (Array.isArray(object.data)) return object.data;
  }
  return value === undefined ? [] : [value];
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  return { value };
}

function display(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return sanitizeTableText(JSON.stringify(value));
  return sanitizeTableText(String(value));
}

function sanitizeTableText(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ');
}
