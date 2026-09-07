export class CliError extends Error {
    exitCode;
    constructor(message, exitCode) {
        super(message);
        this.exitCode = exitCode;
        this.name = new.target.name;
    }
}
export class NetworkError extends CliError {
    constructor(message = 'Unable to reach the KooyaHQ API.') {
        super(message, 1);
    }
}
export class ValidationError extends CliError {
    constructor(message) {
        super(message, 2);
    }
}
export class ConfigError extends CliError {
    constructor(message) {
        super(message, 2);
    }
}
export class ApiError extends CliError {
    status;
    constructor(message, status) {
        super(message, exitCodeForStatus(status));
        this.status = status;
    }
}
export function exitCodeForStatus(status) {
    if (status === 401)
        return 3;
    if (status === 403)
        return 4;
    if (status === 404 || status === 409)
        return 5;
    return 1;
}
export function publicErrorMessage(error) {
    if (error instanceof CliError)
        return error.message;
    return 'Unexpected CLI failure.';
}
//# sourceMappingURL=errors.js.map