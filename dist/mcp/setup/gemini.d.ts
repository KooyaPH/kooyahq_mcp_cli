import type { DoctorReport, SetupDependencies } from './types.js';
export declare function installGeminiIntegration(dependencies: SetupDependencies): Promise<void>;
export declare function doctorGeminiIntegration(dependencies: SetupDependencies, online: boolean): Promise<DoctorReport>;
