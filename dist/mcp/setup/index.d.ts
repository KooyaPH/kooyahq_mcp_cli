import type { SetupOverrides } from './types.js';
export { doctorCodexIntegration, installCodexIntegration } from './codex.js';
export type { SetupDependencies, SetupOverrides } from './types.js';
interface SetupContext {
    homeDirectory: string;
    version: string;
    environment: NodeJS.ProcessEnv;
    platform: NodeJS.Platform;
    onlineCheck: () => Promise<boolean>;
    overrides?: SetupOverrides;
}
export interface SetupCommandResult {
    exitCode: 0 | 2;
    stdout: string[];
    stderr: string[];
}
export declare function runMcpSetupCommand(argv: string[], context: SetupContext): Promise<SetupCommandResult>;
