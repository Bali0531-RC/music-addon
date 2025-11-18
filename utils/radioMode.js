const ytdl = require('youtube-dl-exec');

/**
 * Radio Mode Utility
 * Automatically adds related songs to queue based on YouTube recommendations
 */
class RadioMode {
    constructor(config) {
        this.config = config;
        this.enabled = config.features?.radio_enabled ?? false;
        this.queueRefillAt = config.radio?.queue_refill_at ?? 5;
        this.fetchCount = config.radio?.fetch_count ?? 10;
        
        // Track which guilds have radio mode active
        this.activeRadio = new Map(); // guildId -> { seedVideoId, addedVideos: Set }
    }

    /**
     * Check if radio mode is active for a guild
     */
    isActive(guildId) {
        return this.activeRadio.has(guildId);
    }

    /**
     * Start radio mode for a guild
     */
    start(guildId, seedVideoId) {
        if (!this.enabled) {
            return false;
        }

        this.activeRadio.set(guildId, {
            seedVideoId,
            addedVideos: new Set([seedVideoId])
        });

        return true;
    }

    /**
     * Stop radio mode for a guild
     */
    stop(guildId) {
        this.activeRadio.delete(guildId);
    }

    /**
     * Get radio info for a guild
     */
    getInfo(guildId) {
        return this.activeRadio.get(guildId) || null;
    }

    /**
     * Check if queue needs refill
     */
    shouldRefill(guildId, currentQueueSize) {
        if (!this.isActive(guildId)) {
            return false;
        }

        return currentQueueSize <= this.queueRefillAt;
    }

    /**
     * Fetch related videos from YouTube
     */
    async fetchRelatedVideos(videoId, count = null) {
        if (!this.enabled) {
            return [];
        }

        const fetchLimit = count || this.fetchCount;

        try {
            // Use yt-dlp to get related videos
            const result = await ytdl(videoId, {
                dumpJson: true,
                flatPlaylist: true,
                noWarnings: true,
                noCallHome: true,
                skipDownload: true,
            });

            // Extract related videos from the result
            // Note: yt-dlp may not always return related videos in the same format
            // This is a best-effort approach
            const related = [];

            // Try to get from various possible fields
            if (result.related_videos && Array.isArray(result.related_videos)) {
                related.push(...result.related_videos.slice(0, fetchLimit));
            } else if (result.entries && Array.isArray(result.entries)) {
                related.push(...result.entries.slice(0, fetchLimit));
            }

            // Format the results
            return related.map(video => ({
                id: video.id || video.video_id,
                title: video.title,
                url: video.url || `https://www.youtube.com/watch?v=${video.id || video.video_id}`,
                duration: video.duration,
                thumbnail: video.thumbnail || video.thumbnails?.[0]?.url
            })).filter(v => v.id && v.title);

        } catch (error) {
            console.error('Error fetching related videos:', error);
            return [];
        }
    }

    /**
     * Fetch related videos using search (fallback method)
     */
    async fetchRelatedBySearch(searchQuery, count = null) {
        if (!this.enabled) {
            return [];
        }

        const fetchLimit = count || this.fetchCount;

        try {
            // Search YouTube for similar songs
            const result = await ytdl(`ytsearch${fetchLimit}:${searchQuery}`, {
                dumpJson: true,
                flatPlaylist: true,
                noWarnings: true,
                noCallHome: true,
                skipDownload: true,
            });

            if (!result.entries || !Array.isArray(result.entries)) {
                return [];
            }

            return result.entries.map(video => ({
                id: video.id || video.video_id,
                title: video.title,
                url: video.url || `https://www.youtube.com/watch?v=${video.id || video.video_id}`,
                duration: video.duration,
                thumbnail: video.thumbnail || video.thumbnails?.[0]?.url
            })).filter(v => v.id && v.title);

        } catch (error) {
            console.error('Error searching for related videos:', error);
            return [];
        }
    }

    /**
     * Get next songs for radio mode
     */
    async getNextSongs(guildId, seedTitle, seedArtist = '') {
        const radioInfo = this.getInfo(guildId);
        if (!radioInfo) {
            return [];
        }

        try {
            // First try to get related videos from the seed
            let relatedVideos = await this.fetchRelatedVideos(radioInfo.seedVideoId);

            // If that fails, try searching for similar songs
            if (relatedVideos.length === 0) {
                const searchQuery = seedArtist 
                    ? `${seedArtist} ${seedTitle}`
                    : seedTitle;
                relatedVideos = await this.fetchRelatedBySearch(searchQuery);
            }

            // Filter out videos we've already added
            const newVideos = relatedVideos.filter(video => {
                const alreadyAdded = radioInfo.addedVideos.has(video.id);
                if (!alreadyAdded) {
                    radioInfo.addedVideos.add(video.id);
                }
                return !alreadyAdded;
            });

            return newVideos;

        } catch (error) {
            console.error('Error getting next songs for radio:', error);
            return [];
        }
    }

    /**
     * Mark a video as added to prevent duplicates
     */
    markAsAdded(guildId, videoId) {
        const radioInfo = this.getInfo(guildId);
        if (radioInfo) {
            radioInfo.addedVideos.add(videoId);
        }
    }

    /**
     * Update seed video (useful when queue changes)
     */
    updateSeed(guildId, newSeedVideoId) {
        const radioInfo = this.getInfo(guildId);
        if (radioInfo) {
            radioInfo.seedVideoId = newSeedVideoId;
        }
    }

    /**
     * Clear added videos history
     */
    clearHistory(guildId) {
        const radioInfo = this.getInfo(guildId);
        if (radioInfo) {
            radioInfo.addedVideos.clear();
            radioInfo.addedVideos.add(radioInfo.seedVideoId);
        }
    }

    /**
     * Get statistics for radio mode
     */
    getStats(guildId) {
        const radioInfo = this.getInfo(guildId);
        if (!radioInfo) {
            return null;
        }

        return {
            seedVideoId: radioInfo.seedVideoId,
            songsAdded: radioInfo.addedVideos.size,
            isActive: true
        };
    }
}

module.exports = RadioMode;
