export type ExitCode = 1 | 2 | 3 | 4 | 5;

export class CliError extends Error {
  constructor(message: string, readonly exitCode: ExitCode) {
    super(message);
    this.name = new.target.name;
  }
}

export class NetworkError extends CliError {
  constructor(message = 'Unable to reach the KooyaHQ API.') {
    super(message, 1);
  }
}

export class ValidationError extends CliError {
  constructor(message: string) {
    super(message, 2);
  }
}

export class ConfigError extends CliError {
  constructor(message: string) {
    super(message, 2);
  }
}

export class ApiError extends CliError {
  constructor(message: string, readonly status: number) {
    super(message, exitCodeForStatus(status));
  }
}

export function exitCodeForStatus(status: number): ExitCode {
  if (status === 401) return 3;
  if (status === 403) return 4;
  if (status === 404 || status === 409) return 5;
  return 1;
}

export function publicErrorMessage(error: unknown): string {
  if (error instanceof CliError) return error.message;
  return 'Unexpected CLI failure.';
}
