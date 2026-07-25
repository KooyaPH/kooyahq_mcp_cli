import type { CommandSpec, OptionSpec } from './types.js';
export declare function listQuery(filters?: Record<string, OptionSpec>, sortableFields?: string[]): Record<string, OptionSpec>;
export declare const id: (name?: string) => {
    name: string;
};
export declare const optionalId: (name?: string) => {
    name: string;
    optional: true;
};
export declare function legacyIdSelector(flag: string, pathParam: string, path: string, positionalName?: string): Pick<CommandSpec, 'path' | 'pathParams' | 'positionals' | 'requiredOptions'>;
export declare function legacyOptionalIdSelector(flag: string, pathParam: string, path: string, positionalName?: string): Pick<CommandSpec, 'path' | 'pathParams' | 'positionals'>;
