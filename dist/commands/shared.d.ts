import type { OptionSpec } from './types.js';
export declare const listOptions: Record<string, OptionSpec>;
export declare function listQuery(filters?: Record<string, OptionSpec>): Record<string, OptionSpec>;
export declare const id: (name?: string) => {
    name: string;
};
export declare const optionalId: (name?: string) => {
    name: string;
    optional: true;
};
