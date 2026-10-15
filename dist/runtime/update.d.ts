import type { CommandResult } from '../mcp/setup/types.js';
export declare const LATEST_RELEASE_URL = "https://api.github.com/repos/KooyaPH/kooyahq_mcp_cli/releases/latest";
export interface UpdateOverrides {
    runCommand?: (command: string, args: string[]) => Promise<CommandResult>;
    packageRoot?: string;
}
export interface UpdateContext {
    version: string;
    environment: NodeJS.ProcessEnv;
    homeDirectory: string;
    platform: NodeJS.Platform;
    fetch?: typeof globalThis.fetch;
    prompt: (question: string, hidden?: boolean) => Promise<string>;
    output: {
        stdout: (value: string) => void;
        stderr: (value: string) => void;
    };
    overrides?: UpdateOverrides;
}
export declare function installArguments(tag: string): string[];
export declare function runUpdate(argv: string[], context: UpdateContext): Promise<number>;
