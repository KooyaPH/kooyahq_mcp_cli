export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';
export type ValueType = 'string' | 'integer' | 'boolean' | 'csv' | 'singleton' | 'json-object' | 'json-array';

export interface OptionSpec {
  apiName: string;
  type?: ValueType;
  choices?: string[];
}

export interface PositionalSpec {
  name: string;
  optional?: boolean;
}

export interface TimerEligibility {
  status: 'running' | 'paused';
  positional: string;
}

export interface CommandSpec {
  name: string;
  method: HttpMethod;
  path: string;
  positionals?: PositionalSpec[];
  query?: Record<string, OptionSpec>;
  body?: Record<string, OptionSpec>;
  bodyPositionals?: Record<string, string>;
  staticBody?: Record<string, unknown>;
  requireBody?: boolean;
  requiredOptions?: string[];
  confirmation?: string;
  timerEligibility?: TimerEligibility;
}

export type OutputFormat = 'table' | 'json';

export interface CommandRequest {
  method: HttpMethod;
  path: string;
  query: Record<string, string | number | boolean | string[] | undefined>;
  body?: Record<string, unknown>;
  output: OutputFormat;
  confirmation?: string;
  timerEligibility?: TimerEligibility;
  positionalValues?: Record<string, string | undefined>;
}
