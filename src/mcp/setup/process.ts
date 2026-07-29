import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

import { SUPPORTED_MCP_PROTOCOL_VERSION } from '../server.js';
import type { CommandResult, McpProbeResult } from './types.js';

const PROCESS_TIMEOUT_MS = 10_000;
const PROCESS_OUTPUT_BYTES = 1024 * 1024;
const KILL_GRACE_MS = 250;

export interface ProcessLimits {
  timeoutMs: number;
  maxOutputBytes: number;
  killGraceMs: number;
}

const DEFAULT_LIMITS: ProcessLimits = {
  timeoutMs: PROCESS_TIMEOUT_MS,
  maxOutputBytes: PROCESS_OUTPUT_BYTES,
  killGraceMs: KILL_GRACE_MS,
};

export function codexExecutable(platform: NodeJS.Platform): string {
  return platform === 'win32' ? 'codex.cmd' : 'codex';
}

export function commandRequiresShell(platform: NodeJS.Platform, command: string): boolean {
  return platform === 'win32' && /\.(?:cmd|bat)$/i.test(command);
}

export function windowsShellArgumentsAreSafe(values: string[]): boolean {
  return values.every((value) => !/["%\r\n\0]/u.test(value));
}

export async function runCommand(
  command: string,
  args: string[],
  environment: NodeJS.ProcessEnv,
  platform: NodeJS.Platform = process.platform,
): Promise<CommandResult> {
  return runCommandWithLimits(command, args, environment, DEFAULT_LIMITS, platform);
}

export async function runCommandWithLimits(
  command: string,
  args: string[],
  environment: NodeJS.ProcessEnv,
  limits: ProcessLimits,
  platform: NodeJS.Platform = process.platform,
): Promise<CommandResult> {
  const invocation = commandInvocation(command, args, environment, platform);
  return new Promise((resolve, reject) => {
    const child = spawn(invocation.command, invocation.args, {
      env: sanitizedChildEnvironment(environment),
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsVerbatimArguments: invocation.windowsVerbatimArguments,
    });
    let stdout = '';
    let stderr = '';
    let outputBytes = 0;
    let terminalError: Error | undefined;
    let killTimer: NodeJS.Timeout | undefined;
    const timeout = setTimeout(
      () => terminate(new Error(`Setup command timed out after ${limits.timeoutMs} ms.`)),
      limits.timeoutMs,
    );

    const terminate = (error: Error): void => {
      if (terminalError) return;
      terminalError = error;
      child.kill('SIGTERM');
      killTimer = setTimeout(() => child.kill('SIGKILL'), limits.killGraceMs);
    };

    const capture = (target: 'stdout' | 'stderr', value: Buffer | string): void => {
      if (terminalError) return;
      const text = Buffer.isBuffer(value) ? value.toString('utf8') : value;
      outputBytes += Buffer.byteLength(text, 'utf8');
      if (outputBytes > limits.maxOutputBytes) {
        terminate(new Error(`Setup command exceeded the ${limits.maxOutputBytes}-byte output limit.`));
        return;
      }
      if (target === 'stdout') stdout += text;
      else stderr += text;
    };

    child.stdout.on('data', (value: Buffer | string) => capture('stdout', value));
    child.stderr.on('data', (value: Buffer | string) => capture('stderr', value));
    child.once('error', (error) => { terminalError ??= error; });
    child.once('close', (status) => {
      clearTimeout(timeout);
      if (killTimer) clearTimeout(killTimer);
      if (terminalError) reject(terminalError);
      else resolve({ status: status ?? 1, stdout, stderr });
    });
  });
}

function commandInvocation(
  command: string,
  args: string[],
  environment: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
): { command: string; args: string[]; windowsVerbatimArguments: boolean } {
  if (!commandRequiresShell(platform, command)) {
    return { command, args, windowsVerbatimArguments: false };
  }
  const values = [command, ...args];
  if (!windowsShellArgumentsAreSafe(values)) {
    throw new Error('Windows command arguments contain expansion-prone characters.');
  }
  const commandLine = values.map((value) => `"${value}"`).join(' ');
  return {
    command: environment.ComSpec ?? environment.COMSPEC ?? 'cmd.exe',
    args: ['/d', '/s', '/v:off', '/c', `"${commandLine}"`],
    windowsVerbatimArguments: true,
  };
}

export async function probeMcp(
  nodeExecutable: string,
  scriptPath: string,
  environment: NodeJS.ProcessEnv,
): Promise<McpProbeResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(nodeExecutable, [scriptPath], {
      env: sanitizedChildEnvironment(environment),
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const lines = createInterface({ input: child.stdout });
    let stage = 0;
    let outputBytes = 0;
    let terminalError: Error | undefined;
    let result: McpProbeResult | undefined;
    let killTimer: NodeJS.Timeout | undefined;
    const timeout = setTimeout(
      () => terminate(new Error('MCP handshake timed out.')),
      PROCESS_TIMEOUT_MS,
    );

    const terminate = (error?: Error, value?: McpProbeResult): void => {
      if (terminalError || result) return;
      terminalError = error;
      result = value;
      child.kill('SIGTERM');
      killTimer = setTimeout(() => child.kill('SIGKILL'), KILL_GRACE_MS);
    };

    const countOutput = (value: Buffer | string): boolean => {
      outputBytes += Buffer.byteLength(value, 'utf8');
      if (outputBytes <= PROCESS_OUTPUT_BYTES) return true;
      terminate(new Error('MCP handshake exceeded the output limit.'));
      return false;
    };

    child.stdout.on('data', (value: Buffer | string) => { countOutput(value); });
    child.stderr.on('data', (value: Buffer | string) => { countOutput(value); });
    child.once('error', (error) => { terminalError ??= error; });
    child.once('close', (status) => {
      clearTimeout(timeout);
      if (killTimer) clearTimeout(killTimer);
      lines.close();
      if (terminalError) reject(terminalError);
      else if (result) resolve(result);
      else reject(new Error(`MCP server exited during handshake (${status ?? 'signal'}).`));
    });
    lines.on('line', (line) => {
      if (terminalError || result) return;
      try {
        const response = JSON.parse(line) as {
          id?: number;
          result?: { protocolVersion?: string; tools?: Array<{ name?: string }> };
          error?: { message?: string };
        };
        if (response.error) throw new Error(response.error.message ?? 'MCP handshake failed.');
        if (stage === 0 && response.id === 1) {
          if (response.result?.protocolVersion !== SUPPORTED_MCP_PROTOCOL_VERSION) {
            throw new Error('MCP server returned an unexpected protocol version.');
          }
          stage = 1;
          child.stdin.write(`${JSON.stringify({
            jsonrpc: '2.0', method: 'notifications/initialized',
          })}\n`);
          child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' })}\n`);
          return;
        }
        if (stage === 1 && response.id === 2) {
          const tools = response.result?.tools?.map((tool) => tool.name)
            .filter((name): name is string => typeof name === 'string') ?? [];
          terminate(undefined, { protocolVersion: SUPPORTED_MCP_PROTOCOL_VERSION, tools });
        }
      } catch (error) {
        terminate(error instanceof Error ? error : new Error('Invalid MCP handshake response.'));
      }
    });

    child.stdin.write(`${JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: SUPPORTED_MCP_PROTOCOL_VERSION },
    })}\n`);
  });
}

export function sanitizedChildEnvironment(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const sanitized = { ...environment };
  delete sanitized.KOOYAHQ_ACCESS_KEY_ID;
  delete sanitized.KOOYAHQ_SECRET_ACCESS_KEY;
  return sanitized;
}
