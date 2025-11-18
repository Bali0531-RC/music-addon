const fs = require('fs');
const path = require('path');

/**
 * User Volume Preferences Manager
 * Stores and retrieves user-specific volume preferences
 */

class VolumePreferences {
    constructor(dataFile, defaultVolume = 50) {
        this.dataFile = dataFile;
        this.defaultVolume = defaultVolume;
        this.cache = new Map(); // In-memory cache for faster access
        this.ensureDataFile();
        this.loadCache();
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

    loadCache() {
        try {
            const content = fs.readFileSync(this.dataFile, 'utf8');
            const data = JSON.parse(content);
            this.cache = new Map(Object.entries(data));
        } catch (error) {
            console.error('Failed to load volume preferences:', error);
            this.cache = new Map();
        }
    }

    saveCache() {
        try {
            const data = Object.fromEntries(this.cache);
            fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2), 'utf8');
            return true;
        } catch (error) {
            console.error('Failed to save volume preferences:', error);
            return false;
        }
    }

    /**
     * Get user's preferred volume
     * @param {string} userId - Discord user ID
     * @returns {number} - Volume (0-100)
     */
    getVolume(userId) {
        if (this.cache.has(userId)) {
            return this.cache.get(userId).volume;
        }
        return this.defaultVolume;
    }

    /**
     * Set user's preferred volume
     * @param {string} userId - Discord user ID
     * @param {number} volume - Volume (0-100)
     * @returns {boolean} - Success
     */
    setVolume(userId, volume) {
        if (volume < 0 || volume > 100) {
            return false;
        }

        this.cache.set(userId, {
            volume: volume,
            updatedAt: new Date().toISOString()
        });

        return this.saveCache();
    }

    /**
     * Reset user's volume to default
     * @param {string} userId - Discord user ID
     * @returns {boolean} - Success
     */
    resetVolume(userId) {
        this.cache.delete(userId);
        return this.saveCache();
    }

    /**
     * Get all user preferences
     * @returns {Object} - All preferences
     */
    getAll() {
        return Object.fromEntries(this.cache);
    }

    /**
     * Get statistics about volume preferences
     * @returns {Object} - Stats
     */
    getStats() {
        const volumes = Array.from(this.cache.values()).map(v => v.volume);
        
        if (volumes.length === 0) {
            return {
                totalUsers: 0,
                averageVolume: this.defaultVolume,
                minVolume: 0,
                maxVolume: 100
            };
        }

        const sum = volumes.reduce((a, b) => a + b, 0);
        const avg = Math.round(sum / volumes.length);
        const min = Math.min(...volumes);
        const max = Math.max(...volumes);

        return {
            totalUsers: volumes.length,
            averageVolume: avg,
            minVolume: min,
            maxVolume: max
        };
    }

    /**
     * Clean up old preferences (not used in X days)
     * @param {number} days - Days threshold
     * @returns {number} - Number of entries deleted
     */
    cleanupOld(days = 90) {
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        let deleted = 0;

        for (const [userId, pref] of this.cache.entries()) {
            const updateDate = new Date(pref.updatedAt).getTime();
            
            if (updateDate < cutoff) {
                this.cache.delete(userId);
                deleted++;
            }
        }

        if (deleted > 0) {
            this.saveCache();
        }

        return deleted;
    }
}

module.exports = VolumePreferences;
