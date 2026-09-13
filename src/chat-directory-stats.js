import fs from 'node:fs';
import path from 'node:path';

const CACHE_TTL = 5_000;
const cache = new Map();

/**
 * Invalidates cached aggregate metadata for a character chat directory.
 * @param {string} chatDirectory Absolute character chat directory path
 */
export function invalidateChatDirectoryStats(chatDirectory) {
    cache.delete(path.resolve(chatDirectory));
}

/**
 * Returns aggregate file size and newest modification time for a chat directory.
 * Concurrent requests for the same directory share one scan.
 * @param {string} chatDirectory Absolute character chat directory path
 * @returns {Promise<{chatSize: number, dateLastChat: number}>}
 */
export async function getChatDirectoryStats(chatDirectory) {
    const key = path.resolve(chatDirectory);
    const cached = cache.get(key);
    if (cached && Date.now() - cached.createdAt < CACHE_TTL) {
        return cached.value;
    }

    const value = scanChatDirectory(key).catch(error => {
        cache.delete(key);
        throw error;
    });
    cache.set(key, { createdAt: Date.now(), value });
    return value;
}

/**
 * @param {string} chatDirectory Absolute character chat directory path
 * @returns {Promise<{chatSize: number, dateLastChat: number}>}
 */
async function scanChatDirectory(chatDirectory) {
    let entries;
    try {
        entries = await fs.promises.readdir(chatDirectory, { withFileTypes: true });
    } catch (error) {
        if (error?.code === 'ENOENT') {
            return { chatSize: 0, dateLastChat: 0 };
        }
        throw error;
    }

    let chatSize = 0;
    let dateLastChat = 0;
    const files = entries.filter(entry => entry.isFile());
    const statConcurrency = 64;
    for (let i = 0; i < files.length; i += statConcurrency) {
        const stats = await Promise.all(files.slice(i, i + statConcurrency)
            .map(entry => fs.promises.stat(path.join(chatDirectory, entry.name))));
        for (const stat of stats) {
            chatSize += stat.size;
            dateLastChat = Math.max(dateLastChat, stat.mtimeMs);
        }
    }

    return { chatSize, dateLastChat };
}
