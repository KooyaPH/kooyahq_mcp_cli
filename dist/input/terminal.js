import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
export async function terminalPrompt(question, hidden = false) {
    if (!hidden) {
        const interface_ = createInterface({ input: process.stdin, output: process.stdout });
        try {
            return await interface_.question(`${question} `);
        }
        finally {
            interface_.close();
        }
    }
    process.stdout.write(`${question} `);
    const mutedOutput = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
    const interface_ = createInterface({ input: process.stdin, output: mutedOutput, terminal: true });
    try {
        const answer = await interface_.question('');
        process.stdout.write('\n');
        return answer;
    }
    finally {
        interface_.close();
    }
}
//# sourceMappingURL=terminal.js.map