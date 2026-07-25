export type TicketImportFormat = 'json' | 'csv';
export declare function parseTicketImport(bytes: Uint8Array, format: TicketImportFormat, maxBytes: number, maxItems: number): Array<Record<string, unknown>>;
