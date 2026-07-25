import type { CommandSpec, OptionSpec } from './types.js';
export interface CommandDocumentation {
    summary: string;
    workflow: string;
    examples: string[];
}
export declare function commandDocumentation(command: CommandSpec): CommandDocumentation;
export declare function commandSummary(command: CommandSpec): string;
export declare function workflowFor(scope: string): string;
export declare function commandExamples(command: CommandSpec): string[];
export declare function optionValueLabel(spec: OptionSpec): string;
export declare function optionConstraints(spec: OptionSpec): string[];
