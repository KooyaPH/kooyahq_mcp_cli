export interface SkillInstallOptions {
    staleLockMs?: number;
    waitTimeoutMs?: number;
    retryMs?: number;
    beforePublish?: (relativePath: string) => Promise<void>;
}
export declare function installSkill(packageRoot: string, skillRoot: string, options?: SkillInstallOptions): Promise<void>;
