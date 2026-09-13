import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getChatDirectoryStats, invalidateChatDirectoryStats } from '../src/chat-directory-stats.js';

describe('chat directory stats cache', () => {
    let directory;

    beforeEach(async () => {
        directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'st-chat-stats-'));
    });

    afterEach(async () => {
        invalidateChatDirectoryStats(directory);
        await fs.promises.rm(directory, { recursive: true, force: true });
    });

    test('caches aggregate file metadata until invalidated', async () => {
        await fs.promises.writeFile(path.join(directory, 'one.jsonl'), '1234');
        const initial = await getChatDirectoryStats(directory);
        expect(initial.chatSize).toBe(4);
        expect(initial.dateLastChat).toBeGreaterThan(0);

        await fs.promises.writeFile(path.join(directory, 'two.jsonl'), '123456');
        const cached = await getChatDirectoryStats(directory);
        expect(cached).toEqual(initial);

        invalidateChatDirectoryStats(directory);
        const refreshed = await getChatDirectoryStats(directory);
        expect(refreshed.chatSize).toBe(10);
        expect(refreshed.dateLastChat).toBeGreaterThanOrEqual(initial.dateLastChat);
    });

    test('returns zeroes for a missing directory', async () => {
        await fs.promises.rm(directory, { recursive: true, force: true });
        await expect(getChatDirectoryStats(directory)).resolves.toEqual({ chatSize: 0, dateLastChat: 0 });
    });
});
