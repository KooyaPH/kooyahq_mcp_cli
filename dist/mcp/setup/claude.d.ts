import type { DoctorReport, SetupDependencies } from './types.js';
export declare function installClaudeIntegration(dependencies: SetupDependencies): Promise<void>;
export declare function doctorClaudeIntegration(dependencies: SetupDependencies, online: boolean): Promise<DoctorReport>;
