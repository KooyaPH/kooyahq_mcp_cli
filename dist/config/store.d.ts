import type { Credentials } from './types.js';
export declare function readConfig(path: string): Promise<Credentials | undefined>;
export declare function writeConfig(path: string, credentials: Credentials, platform: NodeJS.Platform): Promise<void>;
export declare function windowsPrivateAclCommands(directory: string, path: string, account: string): string[][];
export declare function clearConfig(path: string): Promise<void>;
