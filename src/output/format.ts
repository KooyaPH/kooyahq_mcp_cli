import type { OutputFormat } from '../commands/types.js';

export function formatOutput(value: unknown, format: OutputFormat): string {
  if (format === 'json') return JSON.stringify(value ?? null, null, 2);
  if (value === undefined) return 'Success.';
  const rows = extractRows(value);
  if (rows.length === 0) return 'No results.';
  const records = rows.map(toRecord);
  const columns = [...new Set(records.flatMap((row) => Object.keys(row)))];
  const widths = columns.map((column) => Math.max(
    column.length,
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
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
