import { open } from 'node:fs/promises';
import { ValidationError } from '../core/errors.js';
export async function readBoundedFile(path, maxBytes) {
    const handle = await open(path, 'r');
    try {
        const stats = await handle.stat();
        if (stats.size > maxBytes)
            throw tooLarge(maxBytes);
        const buffer = Buffer.alloc(stats.size);
        const { bytesRead } = await handle.read(buffer, 0, stats.size, 0);
        return buffer.subarray(0, bytesRead);
    }
    finally {
        await handle.close();
    }
}
export async function readBoundedStdin(maxBytes) {
    const chunks = [];
    let size = 0;
    for await (const value of process.stdin) {
        const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
        size += chunk.length;
        if (size > maxBytes)
            throw tooLarge(maxBytes);
        chunks.push(chunk);
    }
    return Buffer.concat(chunks, size);
}
function tooLarge(maxBytes) {
    return new ValidationError(`Import input exceeds the ${maxBytes} byte limit.`);
}
//# sourceMappingURL=read-bounded.js.map