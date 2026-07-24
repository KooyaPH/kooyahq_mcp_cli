export type ExitCode = 1 | 2 | 3 | 4 | 5;
export declare class CliError extends Error {
    readonly exitCode: ExitCode;
    constructor(message: string, exitCode: ExitCode);
}
export declare class NetworkError extends CliError {
    constructor(message?: string);
}
export declare class ValidationError extends CliError {
    constructor(message: string);
}
export declare class ConfigError extends CliError {
    constructor(message: string);
}
export declare class ApiError extends CliError {
    readonly status: number;
    constructor(message: string, status: number);
}
export declare function exitCodeForStatus(status: number): ExitCode;
export declare function publicErrorMessage(error: unknown): string;
