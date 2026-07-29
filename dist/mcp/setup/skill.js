import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile, } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
const DEFAULT_STALE_LOCK_MS = 30_000;
const DEFAULT_WAIT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_MS = 50;
export async function installSkill(packageRoot, skillRoot, options = {}) {
    await mkdir(skillRoot, { recursive: true });
    const release = await acquireInstallLock(skillRoot, options);
    try {
        await publishSkill(packageRoot, skillRoot, options);
    }
    finally {
        await release();
    }
}
async function publishSkill(packageRoot, skillRoot, options) {
    const source = join(packageRoot, 'skills', 'kooyahq-cli');
    const target = join(skillRoot, 'kooyahq-cli');
    const token = `${process.pid}-${randomUUID()}`;
    const stagedRoot = join(skillRoot, `.kooyahq-cli-stage-${token}`);
    const backupRoot = join(skillRoot, `.kooyahq-cli-backup-${token}`);
    const published = [];
    await mkdir(target, { recursive: true });
    try {
        const files = await listFiles(source);
        assertSingleDocumentSkill(files);
        files.sort((left, right) => {
            if (left === 'VERSION')
                return 1;
            if (right === 'VERSION')
                return -1;
            return left.localeCompare(right);
        });
        for (const relativePath of files) {
            const sourceFile = join(source, relativePath);
            const targetFile = join(target, relativePath);
            const stagedFile = join(stagedRoot, relativePath);
            const backupFile = join(backupRoot, relativePath);
            await mkdir(dirname(targetFile), { recursive: true });
            await mkdir(dirname(stagedFile), { recursive: true });
            await copyFile(sourceFile, stagedFile);
            const existed = await fileExists(targetFile);
            if (existed) {
                await mkdir(dirname(backupFile), { recursive: true });
                await copyFile(targetFile, backupFile);
            }
            await options.beforePublish?.(relativePath);
            await rename(stagedFile, targetFile);
            published.push({ relativePath, existed });
        }
        await removeObsoleteEntries(target, new Set(files));
    }
    catch (error) {
        await rollbackPublishedFiles(target, backupRoot, stagedRoot, published);
        throw error;
    }
    finally {
        await rm(stagedRoot, { recursive: true, force: true });
        await rm(backupRoot, { recursive: true, force: true });
    }
}
function assertSingleDocumentSkill(files) {
    if (files.length !== 2
        || !files.includes('SKILL.md')
        || !files.includes('VERSION')) {
        throw new Error('The packaged KooyaHQ skill must contain only SKILL.md and VERSION.');
    }
}
async function removeObsoleteEntries(target, expected) {
    for (const entry of await readdir(target, { withFileTypes: true })) {
        if (expected.has(entry.name))
            continue;
        await rm(join(target, entry.name), { recursive: true, force: true });
    }
}
async function rollbackPublishedFiles(target, backupRoot, stagedRoot, published) {
    for (const file of [...published].reverse()) {
        const targetFile = join(target, file.relativePath);
        if (!file.existed) {
            await rm(targetFile, { force: true });
            continue;
        }
        const restoreFile = join(stagedRoot, `${file.relativePath}.restore`);
        await mkdir(dirname(restoreFile), { recursive: true });
        await copyFile(join(backupRoot, file.relativePath), restoreFile);
        await rename(restoreFile, targetFile);
    }
}
async function listFiles(root, directory = root) {
    const files = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory())
            files.push(...await listFiles(root, path));
        else if (entry.isFile())
            files.push(relative(root, path));
        else
            throw new Error(`Unsupported skill entry ${entry.name}.`);
    }
    return files;
}
async function acquireInstallLock(skillRoot, options) {
    const lock = join(skillRoot, '.kooyahq-cli-install.lock');
    const recoveryGuard = `${lock}.recovery`;
    const owner = join(lock, 'owner.json');
    const token = randomUUID();
    const staleLockMs = options.staleLockMs ?? DEFAULT_STALE_LOCK_MS;
    const deadline = Date.now() + (options.waitTimeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS);
    const retryMs = options.retryMs ?? DEFAULT_RETRY_MS;
    while (true) {
        try {
            await mkdir(lock);
            await writeFile(owner, JSON.stringify({ token, pid: process.pid, createdAt: Date.now() }));
            return async () => {
                try {
                    const current = JSON.parse(await readFile(owner, 'utf8'));
                    if (current.token === token)
                        await rm(lock, { recursive: true, force: true });
                }
                catch {
                    // A missing or replaced lock is not ours to remove.
                }
            };
        }
        catch (error) {
            if (!hasCode(error, 'EEXIST'))
                throw error;
            if (await staleLockCanBeRecovered(lock, owner, staleLockMs)) {
                await recoverStaleLock(lock, owner, recoveryGuard, staleLockMs);
                continue;
            }
            if (Date.now() >= deadline)
                throw new Error('Timed out waiting for the KooyaHQ skill install lock.');
            await delay(retryMs);
        }
    }
}
async function recoverStaleLock(lock, owner, recoveryGuard, staleLockMs) {
    try {
        await mkdir(recoveryGuard);
    }
    catch (error) {
        if (hasCode(error, 'EEXIST'))
            return;
        throw error;
    }
    try {
        if (await staleLockCanBeRecovered(lock, owner, staleLockMs)) {
            await rm(lock, { recursive: true, force: true });
        }
    }
    finally {
        await rm(recoveryGuard, { recursive: true, force: true });
    }
}
async function staleLockCanBeRecovered(lock, owner, staleLockMs) {
    try {
        if (Date.now() - (await stat(lock)).mtimeMs <= staleLockMs)
            return false;
        try {
            const metadata = JSON.parse(await readFile(owner, 'utf8'));
            return typeof metadata.pid !== 'number' || !processIsAlive(metadata.pid);
        }
        catch {
            return true;
        }
    }
    catch {
        return false;
    }
}
function processIsAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch (error) {
        return hasCode(error, 'EPERM');
    }
}
async function fileExists(path) {
    try {
        return (await stat(path)).isFile();
    }
    catch (error) {
        if (hasCode(error, 'ENOENT'))
            return false;
        throw error;
    }
}
function hasCode(error, code) {
    return Boolean(error && typeof error === 'object' && 'code' in error && error.code === code);
}
async function delay(milliseconds) {
    await new Promise((resolve) => setTimeout(resolve, milliseconds));
}
//# sourceMappingURL=skill.js.map