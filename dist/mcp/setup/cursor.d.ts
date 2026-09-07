import type { DoctorReport, SetupDependencies } from './types.js';
export declare function installCursorIntegration(dependencies: SetupDependencies): Promise<void>;
export declare function doctorCursorIntegration(dependencies: SetupDependencies, online: boolean): Promise<DoctorReport>;
