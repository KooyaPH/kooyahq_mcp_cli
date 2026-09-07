import type { DoctorReport, SetupDependencies } from './types.js';
export declare function installCodexIntegration(dependencies: SetupDependencies): Promise<void>;
export declare function doctorCodexIntegration(dependencies: SetupDependencies, online: boolean): Promise<DoctorReport>;
