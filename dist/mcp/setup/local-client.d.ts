import type { CommandResult, DoctorCheck, SetupDependencies } from './types.js';
export interface LocalMcpDescriptor {
    command: string;
    args: [string];
}
export declare function localMcpDescriptor(dependencies: SetupDependencies): LocalMcpDescriptor;
export declare function requireLocalMcpDescriptor(dependencies: SetupDependencies): Promise<LocalMcpDescriptor>;
export declare function localMcpTargetCheck(dependencies: SetupDependencies): Promise<DoctorCheck>;
export declare function localMcpEntryMatches(value: unknown, descriptor: LocalMcpDescriptor): boolean;
export declare function localMcpHandshakeCheck(dependencies: SetupDependencies): Promise<DoctorCheck>;
export declare function onlineStatusCheck(dependencies: SetupDependencies): Promise<DoctorCheck>;
export declare function projectGateCheck(): DoctorCheck;
export declare function runRegistrationCommand(dependencies: SetupDependencies, clientName: string, command: string, args: string[]): Promise<void>;
export declare function requireCommandRegistrationAbsent(dependencies: SetupDependencies, clientName: string, command: string, args: string[], isProvenAbsent: (result: CommandResult) => boolean, manualRegistration: string): Promise<void>;
export declare function unverifiableCommandRegistrationCheck(dependencies: SetupDependencies, clientName: string, command: string, args: string[]): Promise<DoctorCheck>;
