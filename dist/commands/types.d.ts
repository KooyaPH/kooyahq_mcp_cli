export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';
export type ValueType = 'string' | 'integer' | 'number' | 'boolean' | 'switch' | 'csv' | 'singleton' | 'json-object' | 'json-array';
export interface OptionSpec {
    apiName: string;
    type?: ValueType;
    choices?: string[];
    itemChoices?: string[];
    numericChoices?: number[];
    constant?: string | number | boolean | null | unknown[] | Record<string, unknown>;
    format?: 'date' | 'datetime' | 'https-url' | 'hex-color' | 'email' | 'board-key' | 'ticket-key' | 'object-id' | 'uuid';
    min?: number;
    max?: number;
    maxLength?: number;
    maxItems?: number;
    uniqueItems?: boolean;
    caseInsensitiveUniqueItems?: boolean;
    itemMaxLength?: number;
    pattern?: string;
    patternDescription?: string;
    jsonNumericOrder?: Array<{
        lower: string;
        upper: string;
    }>;
    jsonSchema?: Record<string, unknown>;
    example?: string;
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
export interface ConditionalExactlyOne {
    when: {
        option: string;
        value: string;
    };
    options: string[];
}
export interface DateRangeSpec {
    startOption: string;
    endOption: string;
    maxDays: number;
    requireDistinctDates?: boolean;
}
export interface DateTimeRangeSpec {
    startOption: string;
    endOption: string;
}
export interface CommandSpec {
    name: string;
    method: HttpMethod;
    path: string;
    positionals?: PositionalSpec[];
    pathParams?: Record<string, OptionSpec>;
    pathVariants?: PathVariant[];
    exactlyOne?: string[][];
    atLeastOne?: string[][];
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
    dateRange?: DateRangeSpec | DateRangeSpec[];
    dateTimeRange?: DateTimeRangeSpec | DateTimeRangeSpec[];
    conditionalRequirements?: ConditionalRequirement[];
    conditionalExactlyOne?: ConditionalExactlyOne[];
    pairedOptions?: string[][];
    response?: {
        description: string;
        fields?: string[];
    };
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
