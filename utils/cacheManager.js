const fs = require('fs');
const path = require('path');

/**
 * Smart Cache Manager
 * Manages cached audio files based on popularity and size limits
 */
class CacheManager {
    constructor(config, tmpDir) {
        this.config = config;
        this.tmpDir = tmpDir;
        this.enabled = config.features?.smart_cache_enabled ?? false;
        this.popularThreshold = config.smart_cache?.popular_threshold ?? 3;
        this.maxSizeMB = config.smart_cache?.max_size_mb ?? 1000;
        
        // Track cache statistics
        this.stats = {
            hits: 0,
            misses: 0,
            totalFiles: 0,
            totalSizeMB: 0
        };
        
        // Load stats if exists
        this.loadStats();
    }

    /**
     * Load cache statistics from file
     */
    loadStats() {
        const statsFile = path.join(this.tmpDir, '.cache_stats.json');
        if (fs.existsSync(statsFile)) {
            try {
                const data = fs.readFileSync(statsFile, 'utf8');
                this.stats = JSON.parse(data);
            } catch (error) {
                console.error('Error loading cache stats:', error);
            }
        }
    }

    /**
     * Save cache statistics to file
     */
    saveStats() {
        const statsFile = path.join(this.tmpDir, '.cache_stats.json');
        try {
            fs.writeFileSync(statsFile, JSON.stringify(this.stats, null, 2));
        } catch (error) {
            console.error('Error saving cache stats:', error);
        }
    }

    /**
     * Check if file exists in cache (cache hit)
     */
    checkHit(videoId) {
        const filePath = path.join(this.tmpDir, `${videoId}.mp3`);
        const exists = fs.existsSync(filePath);
        
        if (exists) {
            this.stats.hits++;
        } else {
            this.stats.misses++;
        }
        
        this.saveStats();
        return exists;
    }

    /**
     * Get cache statistics
     */
    getStats() {
        this.updateCacheSize();
        return {
            ...this.stats,
            hitRate: this.stats.hits + this.stats.misses > 0
                ? ((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100).toFixed(2)
                : 0
        };
    }

    /**
     * Update cache size statistics
     */
    updateCacheSize() {
        if (!fs.existsSync(this.tmpDir)) {
            this.stats.totalFiles = 0;
            this.stats.totalSizeMB = 0;
            return;
        }

        const files = fs.readdirSync(this.tmpDir);
        let totalSize = 0;
        let fileCount = 0;

        files.forEach(file => {
            if (file.endsWith('.mp3')) {
                const filePath = path.join(this.tmpDir, file);
                try {
                    const stats = fs.statSync(filePath);
                    totalSize += stats.size;
                    fileCount++;
                } catch (error) {
                    // File might have been deleted
                }
            }
        });

        this.stats.totalFiles = fileCount;
        this.stats.totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
        this.saveStats();
    }

    /**
     * Clean cache based on rules
     */
    cleanCache(playCountMap = {}) {
        if (!this.enabled) return { deleted: 0, keptPopular: 0 };

        if (!fs.existsSync(this.tmpDir)) {
            return { deleted: 0, keptPopular: 0 };
        }

        const files = fs.readdirSync(this.tmpDir);
        let deleted = 0;
        let keptPopular = 0;
        let totalSize = 0;

        // First pass: calculate total size and identify files
        const fileInfo = [];
        files.forEach(file => {
            if (!file.endsWith('.mp3')) return;

            const filePath = path.join(this.tmpDir, file);
            try {
                const stats = fs.statSync(filePath);
                const videoId = path.basename(file, '.mp3');
                const playCount = playCountMap[videoId] || 0;

                fileInfo.push({
                    file,
                    filePath,
                    videoId,
                    size: stats.size,
                    atime: stats.atime,
                    playCount,
                    isPopular: playCount >= this.popularThreshold
                });

                totalSize += stats.size;
            } catch (error) {
                // File might have been deleted
            }
        });

        const totalSizeMB = totalSize / (1024 * 1024);

        // If under size limit, only delete unpopular old files
        if (totalSizeMB <= this.maxSizeMB) {
            // Sort by access time (oldest first)
            fileInfo.sort((a, b) => a.atime - b.atime);

            fileInfo.forEach(info => {
                if (!info.isPopular) {
                    // Delete unpopular files that haven't been accessed recently
                    const daysSinceAccess = (Date.now() - info.atime.getTime()) / (1000 * 60 * 60 * 24);
                    if (daysSinceAccess > 7) { // Delete if not accessed in 7 days
                        try {
                            fs.unlinkSync(info.filePath);
                            deleted++;
                        } catch (error) {
                            console.error(`Error deleting ${info.file}:`, error);
                        }
                    }
                } else {
                    keptPopular++;
                }
            });
        } else {
            // Over size limit: aggressive cleanup
            // Keep popular files, delete least recently accessed unpopular files
            fileInfo.sort((a, b) => {
                // Popular files first
                if (a.isPopular && !b.isPopular) return 1;
                if (!a.isPopular && b.isPopular) return -1;
                // Then by access time (oldest first)
                return a.atime - b.atime;
            });

            let currentSize = totalSizeMB;
            for (const info of fileInfo) {
                if (currentSize <= this.maxSizeMB * 0.8) { // Target 80% of max
                    break;
                }

                if (!info.isPopular) {
                    try {
                        fs.unlinkSync(info.filePath);
                        currentSize -= info.size / (1024 * 1024);
                        deleted++;
                    } catch (error) {
                        console.error(`Error deleting ${info.file}:`, error);
                    }
                } else {
                    keptPopular++;
                }
            }
        }

        this.updateCacheSize();
        return { deleted, keptPopular };
    }

    /**
     * Clear entire cache
     */
    clearAll() {
        if (!fs.existsSync(this.tmpDir)) {
            return 0;
        }

        const files = fs.readdirSync(this.tmpDir);
        let deleted = 0;

        files.forEach(file => {
            if (file.endsWith('.mp3') || file === '.cache_stats.json') {
                const filePath = path.join(this.tmpDir, file);
                try {
                    fs.unlinkSync(filePath);
                    if (file.endsWith('.mp3')) deleted++;
                } catch (error) {
                    console.error(`Error deleting ${file}:`, error);
                }
            }
        });

        // Reset stats
        this.stats = {
            hits: 0,
            misses: 0,
            totalFiles: 0,
            totalSizeMB: 0
        };
        this.saveStats();

        return deleted;
    }

    /**
     * Get list of cached files with details
     */
    getCachedFiles(playCountMap = {}) {
        if (!fs.existsSync(this.tmpDir)) {
            return [];
        }

        const files = fs.readdirSync(this.tmpDir);
        const cached = [];

        files.forEach(file => {
            if (!file.endsWith('.mp3')) return;

            const filePath = path.join(this.tmpDir, file);
            try {
                const stats = fs.statSync(filePath);
                const videoId = path.basename(file, '.mp3');
                const playCount = playCountMap[videoId] || 0;

                cached.push({
                    videoId,
                    file,
                    sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
                    playCount,
                    isPopular: playCount >= this.popularThreshold,
                    lastAccess: stats.atime,
                    created: stats.birthtime
                });
            } catch (error) {
                // File might have been deleted
            }
        });

        // Sort by play count (most popular first)
        cached.sort((a, b) => b.playCount - a.playCount);

        return cached;
    }

    /**
     * Reset cache statistics
     */
    resetStats() {
        this.stats = {
            hits: 0,
            misses: 0,
            totalFiles: this.stats.totalFiles,
            totalSizeMB: this.stats.totalSizeMB
        };
        this.saveStats();
    }
}

module.exports = CacheManager;
