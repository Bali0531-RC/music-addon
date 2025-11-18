const https = require('https');

/**
 * Lyrics Fetcher Utility
 * Fetches song lyrics from Genius API
 */
class LyricsFetcher {
    constructor(config) {
        this.config = config;
        this.enabled = config.features?.lyrics_enabled ?? false;
        this.apiKey = config.lyrics?.api_key || '';
        this.baseUrl = 'https://api.genius.com';
        this.cache = new Map(); // Cache lyrics to reduce API calls
    }

    /**
     * Check if lyrics feature is properly configured
     */
    isConfigured() {
        return this.enabled && this.apiKey && this.apiKey.length > 0;
    }

    /**
     * Search for a song on Genius
     */
    async searchSong(query) {
        if (!this.isConfigured()) {
            throw new Error('Lyrics feature is not configured. Please add your Genius API key.');
        }

        const encodedQuery = encodeURIComponent(query);
        const url = `${this.baseUrl}/search?q=${encodedQuery}`;

        return new Promise((resolve, reject) => {
            const options = {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            };

            https.get(url, options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.response && parsed.response.hits && parsed.response.hits.length > 0) {
                            resolve(parsed.response.hits[0].result);
                        } else {
                            resolve(null);
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            }).on('error', (error) => {
                reject(error);
            });
        });
    }

    /**
     * Fetch lyrics from Genius page
     * Note: Genius API doesn't provide lyrics directly, only song metadata
     * This is a simplified version that returns song information
     */
    async fetchLyrics(songTitle, artistName = '') {
        if (!this.isConfigured()) {
            return {
                success: false,
                error: 'Lyrics feature is not configured'
            };
        }

        // Check cache first
        const cacheKey = `${songTitle}-${artistName}`.toLowerCase();
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            // Build search query
            let query = songTitle;
            if (artistName) {
                query = `${artistName} ${songTitle}`;
            }

            // Remove common suffixes that might interfere with search
            query = query
                .replace(/\(official.*?\)/gi, '')
                .replace(/\(lyrics.*?\)/gi, '')
                .replace(/\[official.*?\]/gi, '')
                .replace(/\[lyrics.*?\]/gi, '')
                .replace(/\s+/g, ' ')
                .trim();

            const song = await this.searchSong(query);

            if (!song) {
                const result = {
                    success: false,
                    error: 'Song not found on Genius'
                };
                this.cache.set(cacheKey, result);
                return result;
            }

            // Return song information
            // Note: Actual lyrics extraction would require web scraping
            // which is against Genius ToS. We provide the link instead.
            const result = {
                success: true,
                title: song.title,
                artist: song.primary_artist?.name || 'Unknown Artist',
                url: song.url,
                thumbnail: song.song_art_image_url,
                albumArt: song.header_image_url,
                releaseDate: song.release_date_for_display,
                // Lyrics are not provided by API - user must visit URL
                lyricsAvailable: false,
                message: 'Visit the link above to view full lyrics'
            };

            // Cache the result
            this.cache.set(cacheKey, result);

            return result;
        } catch (error) {
            console.error('Lyrics fetch error:', error);
            return {
                success: false,
                error: error.message || 'Failed to fetch lyrics'
            };
        }
    }

    /**
     * Extract song title and artist from YouTube title
     */
    parseSongInfo(youtubeTitle) {
        // Common patterns: "Artist - Song", "Artist: Song", "Song by Artist"
        let artist = '';
        let title = youtubeTitle;

        // Remove common suffixes
        title = title
            .replace(/\(official.*?\)/gi, '')
            .replace(/\(lyrics.*?\)/gi, '')
            .replace(/\[official.*?\]/gi, '')
            .replace(/\[lyrics.*?\]/gi, '')
            .replace(/official\s+(video|audio|music\s+video)/gi, '')
            .replace(/\s+/g, ' ')
            .trim();

        // Try to split artist - title
        if (title.includes(' - ')) {
            const parts = title.split(' - ');
            if (parts.length >= 2) {
                artist = parts[0].trim();
                title = parts.slice(1).join(' - ').trim();
            }
        } else if (title.includes(': ')) {
            const parts = title.split(': ');
            if (parts.length >= 2) {
                artist = parts[0].trim();
                title = parts.slice(1).join(': ').trim();
            }
        } else if (title.toLowerCase().includes(' by ')) {
            const parts = title.split(/\s+by\s+/i);
            if (parts.length >= 2) {
                title = parts[0].trim();
                artist = parts[1].trim();
            }
        }

        return { title, artist };
    }

    /**
     * Clear the lyrics cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Get cache size
     */
    getCacheSize() {
        return this.cache.size;
    }
}

module.exports = LyricsFetcher;
