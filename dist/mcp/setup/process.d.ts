import type { CommandResult, McpProbeResult } from './types.js';
export interface ProcessLimits {
    timeoutMs: number;
    maxOutputBytes: number;
    killGraceMs: number;
}
export declare function codexExecutable(platform: NodeJS.Platform): string;
export declare function commandRequiresShell(platform: NodeJS.Platform, command: string): boolean;
export declare function windowsShellArgumentsAreSafe(values: string[]): boolean;
export declare function runCommand(command: string, args: string[], environment: NodeJS.ProcessEnv, platform?: NodeJS.Platform): Promise<CommandResult>;
export declare function runCommandWithLimits(command: string, args: string[], environment: NodeJS.ProcessEnv, limits: ProcessLimits, platform?: NodeJS.Platform): Promise<CommandResult>;
export declare function probeMcp(nodeExecutable: string, scriptPath: string, environment: NodeJS.ProcessEnv): Promise<McpProbeResult>;
export declare function sanitizedChildEnvironment(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
