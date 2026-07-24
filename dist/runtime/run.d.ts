export interface RuntimeDependencies {
    environment: NodeJS.ProcessEnv;
    homeDirectory: string;
    platform: NodeJS.Platform;
    version: string;
    fetch: typeof globalThis.fetch;
    prompt: (question: string, hidden?: boolean) => Promise<string>;
    output: {
        stdout: (value: string) => void;
        stderr: (value: string) => void;
    };
}
export declare function defaultDependencies(version: string, prompt: RuntimeDependencies['prompt']): RuntimeDependencies;
export declare function runCli(argv: string[], dependencies: RuntimeDependencies): Promise<number>;
