const fs = require('fs');
const path = require('path');

/**
 * Queue Persistence Utility
 * Saves and restores music queues across bot restarts
 */

class QueuePersistence {
    constructor(dataFile) {
        this.dataFile = dataFile;
        this.ensureDataFile();
    }

    ensureDataFile() {
        const dir = path.dirname(this.dataFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (!fs.existsSync(this.dataFile)) {
            fs.writeFileSync(this.dataFile, JSON.stringify({}), 'utf8');
        }
    }

    /**
     * Save a guild's queue state
     * @param {string} guildId - Guild ID
     * @param {Object} state - Queue state object
     */
    saveQueue(guildId, state) {
        try {
            const data = this.loadAll();
            data[guildId] = {
                ...state,
                savedAt: new Date().toISOString()
            };
            fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2), 'utf8');
            return true;
        } catch (error) {
            console.error('Failed to save queue:', error);
            return false;
        }
    }

    /**
     * Load a guild's queue state
     * @param {string} guildId - Guild ID
     * @returns {Object|null} - Queue state or null
     */
    loadQueue(guildId) {
        try {
            const data = this.loadAll();
            return data[guildId] || null;
        } catch (error) {
            console.error('Failed to load queue:', error);
            return null;
        }
    }

    /**
     * Load all saved queues
     * @returns {Object} - All queue states
     */
    loadAll() {
        try {
            const content = fs.readFileSync(this.dataFile, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            console.error('Failed to load queues:', error);
            return {};
        }
    }

    /**
     * Delete a guild's saved queue
     * @param {string} guildId - Guild ID
     */
    deleteQueue(guildId) {
        try {
            const data = this.loadAll();
            delete data[guildId];
            fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2), 'utf8');
            return true;
        } catch (error) {
            console.error('Failed to delete queue:', error);
            return false;
        }
    }

    /**
     * Clear all saved queues
     */
    clearAll() {
        try {
            fs.writeFileSync(this.dataFile, JSON.stringify({}), 'utf8');
            return true;
        } catch (error) {
            console.error('Failed to clear queues:', error);
            return false;
        }
    }

    /**
     * Get statistics about saved queues
     * @returns {Object} - Stats object
     */
    getStats() {
        try {
            const data = this.loadAll();
            const guilds = Object.keys(data);
            let totalSongs = 0;
            let oldestSave = null;
            let newestSave = null;

            for (const guildId in data) {
                const queue = data[guildId];
                if (queue.queue) {
                    totalSongs += queue.queue.length;
                }
                if (queue.nowPlaying) {
                    totalSongs += 1;
                }
                
                const saveDate = new Date(queue.savedAt);
                if (!oldestSave || saveDate < oldestSave) {
                    oldestSave = saveDate;
                }
                if (!newestSave || saveDate > newestSave) {
                    newestSave = saveDate;
                }
            }

            return {
                totalGuilds: guilds.length,
                totalSongs,
                oldestSave,
                newestSave
            };
        } catch (error) {
            console.error('Failed to get queue stats:', error);
            return {
                totalGuilds: 0,
                totalSongs: 0,
                oldestSave: null,
                newestSave: null
            };
        }
    }

    /**
     * Clean up old saved queues (older than X days)
     * @param {number} days - Days threshold
     * @returns {number} - Number of queues deleted
     */
    cleanupOld(days = 7) {
        try {
            const data = this.loadAll();
            const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
            let deleted = 0;

            for (const guildId in data) {
                const queue = data[guildId];
                const saveDate = new Date(queue.savedAt).getTime();
                
                if (saveDate < cutoff) {
                    delete data[guildId];
                    deleted++;
                }
            }

            if (deleted > 0) {
                fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2), 'utf8');
            }

            return deleted;
        } catch (error) {
            console.error('Failed to cleanup old queues:', error);
            return 0;
        }
    }
}

module.exports = QueuePersistence;
