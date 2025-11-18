const fs = require('fs');
const path = require('path');

/**
 * Statistics Manager - Persistent storage for music bot statistics
 */
class StatisticsManager {
    constructor(config) {
        this.config = config;
        this.dataFile = path.join(__dirname, '..', config.statistics.data_file);
        this.dataDir = path.dirname(this.dataFile);
        
        // In-memory cache
        this.data = {
            guilds: {} // guildId -> { history: [], playCount: {} }
        };
        
        this.ensureDataDir();
        this.load();
    }

    /**
     * Ensure data directory exists
     */
    ensureDataDir() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }

    /**
     * Load statistics from file
     */
    load() {
        try {
            if (fs.existsSync(this.dataFile)) {
                const data = fs.readFileSync(this.dataFile, 'utf8');
                this.data = JSON.parse(data);
            }
        } catch (error) {
            console.error('Error loading statistics:', error);
            this.data = { guilds: {} };
        }
    }

    /**
     * Save statistics to file
     */
    save() {
        try {
            fs.writeFileSync(this.dataFile, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('Error saving statistics:', error);
        }
    }

    /**
     * Get guild statistics
     */
    getGuildStats(guildId) {
        if (!this.data.guilds[guildId]) {
            this.data.guilds[guildId] = {
                history: [],
                playCount: {}
            };
        }
        return this.data.guilds[guildId];
    }

    /**
     * Add song to history
     */
    addToHistory(guildId, song) {
        const stats = this.getGuildStats(guildId);
        
        const historyEntry = {
            title: song.title,
            url: song.url,
            id: song.id,
            duration: song.duration,
            requester: song.requester || 'Unknown',
            requesterId: song.requesterId,
            playedAt: new Date().toISOString()
        };
        
        // Add to beginning
        stats.history.unshift(historyEntry);
        
        // Limit history size
        const maxEntries = this.config.history.max_entries || 50;
        if (stats.history.length > maxEntries) {
            stats.history = stats.history.slice(0, maxEntries);
        }
        
        this.save();
    }

    /**
     * Increment play count for a song
     */
    incrementPlayCount(guildId, songId) {
        const stats = this.getGuildStats(guildId);
        stats.playCount[songId] = (stats.playCount[songId] || 0) + 1;
        this.save();
    }

    /**
     * Get history for guild
     */
    getHistory(guildId, limit = null) {
        const stats = this.getGuildStats(guildId);
        if (limit) {
            return stats.history.slice(0, limit);
        }
        return stats.history;
    }

    /**
     * Get play count for a song
     */
    getPlayCount(guildId, songId) {
        const stats = this.getGuildStats(guildId);
        return stats.playCount[songId] || 0;
    }

    /**
     * Get all play counts for guild
     */
    getAllPlayCounts(guildId) {
        const stats = this.getGuildStats(guildId);
        return { ...stats.playCount };
    }

    /**
     * Clear history for guild
     */
    clearHistory(guildId) {
        const stats = this.getGuildStats(guildId);
        stats.history = [];
        this.save();
    }

    /**
     * Clear all statistics for guild
     */
    clearGuildStats(guildId) {
        this.data.guilds[guildId] = {
            history: [],
            playCount: {}
        };
        this.save();
    }
}

module.exports = StatisticsManager;
