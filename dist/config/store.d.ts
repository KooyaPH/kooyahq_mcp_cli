import type { Credentials } from './types.js';
export declare function readConfig(path: string): Promise<Credentials | undefined>;
export declare function writeConfig(path: string, credentials: Credentials, platform: NodeJS.Platform, options?: {
    applyWindowsAcl?: (directory: string, path?: string) => Promise<void>;
}): Promise<void>;
export declare function windowsPrivateAclCommands(directory: string, path: string, account: string): string[][];
export declare function clearConfig(path: string): Promise<void>;
