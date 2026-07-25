export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';
export type ValueType = 'string' | 'integer' | 'number' | 'boolean' | 'switch' | 'csv' | 'singleton' | 'json-object' | 'json-array';
export interface OptionSpec {
    apiName: string;
    type?: ValueType;
    choices?: string[];
    constant?: string | number | boolean | null;
    format?: 'date' | 'datetime' | 'https-url' | 'hex-color' | 'email' | 'board-key' | 'ticket-key';
    min?: number;
    max?: number;
    maxLength?: number;
    maxItems?: number;
    uniqueItems?: boolean;
}
export interface PositionalSpec {
    name: string;
    optional?: boolean;
    aliasFor?: string;
    deprecated?: boolean;
}
export interface PathVariant {
    path: string;
    when: string[];
}
export interface TimerEligibility {
    status: 'running' | 'paused';
    positional: string;
    pathParam?: string;
}
export interface FileInputSpec {
    bodyName: string;
    maxBytes: number;
    maxItems: number;
}
export interface ConditionalRequirement {
    option: string;
    requires: string;
    value: string;
}
export interface CommandSpec {
    name: string;
    method: HttpMethod;
    path: string;
    positionals?: PositionalSpec[];
    pathParams?: Record<string, OptionSpec>;
    pathVariants?: PathVariant[];
    exactlyOne?: string[][];
    atMostOne?: string[][];
    query?: Record<string, OptionSpec>;
    body?: Record<string, OptionSpec>;
    bodyPositionals?: Record<string, string>;
    staticBody?: Record<string, unknown>;
    requireBody?: boolean;
    requiredOptions?: string[];
    confirmation?: string;
    timerEligibility?: TimerEligibility;
    fileInput?: FileInputSpec;
    dateRange?: {
        startOption: string;
        endOption: string;
        maxDays: number;
    };
    conditionalRequirements?: ConditionalRequirement[];
    pairedOptions?: string[][];
}
export type OutputFormat = 'table' | 'json' | 'raw';
export interface CommandRequest {
    method: HttpMethod;
    path: string;
    query: Record<string, string | number | boolean | string[] | undefined>;
    body?: Record<string, unknown>;
    output: OutputFormat;
    confirmation?: string;
    timerEligibility?: TimerEligibility;
    positionalValues?: Record<string, string | undefined>;
    warnings?: string[];
    dryRun?: boolean;
    all?: boolean;
    fileInput?: FileInputSpec & {
        path?: string;
        stdin: boolean;
        format: 'json' | 'csv';
    };
}
