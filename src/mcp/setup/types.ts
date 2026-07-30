export interface CommandResult {
  status: number;
  stdout: string;
  stderr: string;
}

export interface McpProbeResult {
  protocolVersion: string;
  tools: string[];
}

export interface DoctorCheck {
  name: string;
  ok: boolean;
  message: string;
}

export interface DoctorReport {
  ok: boolean;
  checks: DoctorCheck[];
}

export type McpClient =
  | 'codex'
  | 'cursor'
  | 'claude'
  | 'gemini'
  | 'antigravity'
  | 'openclaw'
  | 'hermes';

export interface SetupDependencies {
  homeDirectory: string;
  codexRoot: string;
  codexCommand: string;
  claudeCommand: string;
  openclawCommand: string;
  hermesCommand: string;
  platform: NodeJS.Platform;
  packageRoot: string;
  version: string;
  nodeExecutable: string;
  environment: NodeJS.ProcessEnv;
  runCommand: (command: string, args: string[]) => Promise<CommandResult>;
  probeMcp: (
    nodeExecutable: string,
    scriptPath: string,
    environment: NodeJS.ProcessEnv,
  ) => Promise<McpProbeResult>;
  onlineCheck: () => Promise<boolean>;
}

export type SetupOverrides = Partial<Pick<
  SetupDependencies,
  'packageRoot' | 'nodeExecutable' | 'runCommand' | 'probeMcp'
>>;
