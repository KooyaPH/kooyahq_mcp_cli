export interface RuntimeDependencies {
    environment: NodeJS.ProcessEnv;
    homeDirectory: string;
    platform: NodeJS.Platform;
    version: string;
    fetch: typeof globalThis.fetch;
    prompt: (question: string, hidden?: boolean) => Promise<string>;
    readInputFile: (path: string, maxBytes: number) => Promise<Uint8Array>;
    readStandardInput: (maxBytes: number) => Promise<Uint8Array>;
    output: {
        stdout: (value: string) => void;
        stderr: (value: string) => void;
    };
}
export declare function defaultDependencies(version: string, prompt: RuntimeDependencies['prompt']): RuntimeDependencies;
export declare function runCli(argv: string[], dependencies: RuntimeDependencies): Promise<number>;
