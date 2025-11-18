const { EmbedBuilder } = require('discord.js');

/**
 * Rich Now Playing Manager
 * Creates auto-updating embeds with progress bars
 */
class RichNowPlaying {
    constructor(config) {
        this.config = config;
        this.enabled = config.features?.rich_nowplaying_enabled ?? false;
        this.updateInterval = (config.rich_nowplaying?.update_interval ?? 10) * 1000;
        this.showProgressBar = config.rich_nowplaying?.show_progress_bar ?? true;
        
        // Track active embeds (guildId -> { message, interval, startTime, song })
        this.activeEmbeds = new Map();
    }

    /**
     * Generate progress bar
     */
    generateProgressBar(currentSeconds, totalSeconds, barLength = 15) {
        if (!this.showProgressBar || totalSeconds === 0) {
            return null;
        }

        const progress = currentSeconds / totalSeconds;
        const filledLength = Math.floor(progress * barLength);
        const emptyLength = barLength - filledLength;

        const filled = '█'.repeat(filledLength);
        const empty = '░'.repeat(emptyLength);
        
        return `${filled}${empty}`;
    }

    /**
     * Format time as MM:SS
     */
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Create now playing embed
     */
    createEmbed(song, elapsedSeconds = 0) {
        const progressBar = this.generateProgressBar(elapsedSeconds, song.duration);
        const currentTime = this.formatTime(elapsedSeconds);
        const totalTime = this.formatTime(song.duration);

        const embed = new EmbedBuilder()
            .setColor(this.config.embed_colors.success)
            .setTitle(this.config.messages.now_playing || '🎵 Now Playing')
            .setDescription(`**[${song.title}](${song.url})**`);

        if (progressBar && song.duration > 0) {
            embed.addFields({
                name: '\u200b',
                value: `${progressBar} ${currentTime} / ${totalTime}`,
                inline: false
            });
        } else if (song.duration > 0) {
            embed.addFields({
                name: this.config.messages.duration || 'Duration',
                value: totalTime,
                inline: true
            });
        }

        if (song.requester) {
            embed.addFields({
                name: this.config.messages.requested_by || 'Requested by',
                value: song.requester,
                inline: true
            });
        }

        embed.setFooter({ 
            text: this.config.messages.rich_nowplaying_footer || 'Auto-updating...' 
        });

        return embed;
    }

    /**
     * Start rich now playing for a song
     */
    async start(guildId, textChannel, song) {
        if (!this.enabled) return null;

        // Stop any existing embed for this guild
        this.stop(guildId);

        try {
            // Send initial embed
            const embed = this.createEmbed(song, 0);
            const message = await textChannel.send({ embeds: [embed] });

            const startTime = Date.now();

            // Set up update interval
            const interval = setInterval(async () => {
                const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);

                // Stop if elapsed exceeds duration
                if (song.duration > 0 && elapsedSeconds >= song.duration) {
                    this.stop(guildId);
                    return;
                }

                try {
                    const updatedEmbed = this.createEmbed(song, elapsedSeconds);
                    await message.edit({ embeds: [updatedEmbed] });
                } catch (error) {
                    // Message might have been deleted
                    console.error('Error updating rich now playing:', error.message);
                    this.stop(guildId);
                }
            }, this.updateInterval);

            // Store active embed info
            this.activeEmbeds.set(guildId, {
                message,
                interval,
                startTime,
                song
            });

            return message;
        } catch (error) {
            console.error('Error starting rich now playing:', error);
            return null;
        }
    }

    /**
     * Stop rich now playing for a guild
     */
    stop(guildId) {
        const embedInfo = this.activeEmbeds.get(guildId);
        if (!embedInfo) return;

        // Clear interval
        clearInterval(embedInfo.interval);

        // Delete message
        try {
            embedInfo.message.delete().catch(() => {});
        } catch (error) {
            // Message might already be deleted
        }

        this.activeEmbeds.delete(guildId);
    }

    /**
     * Check if rich now playing is active for guild
     */
    isActive(guildId) {
        return this.activeEmbeds.has(guildId);
    }

    /**
     * Get current embed info
     */
    getInfo(guildId) {
        return this.activeEmbeds.get(guildId) || null;
    }

    /**
     * Stop all active embeds
     */
    stopAll() {
        for (const guildId of this.activeEmbeds.keys()) {
            this.stop(guildId);
        }
    }

    /**
     * Update embed immediately (useful for pause/resume)
     */
    async updateNow(guildId, isPaused = false) {
        const embedInfo = this.activeEmbeds.get(guildId);
        if (!embedInfo) return;

        try {
            const elapsedSeconds = Math.floor((Date.now() - embedInfo.startTime) / 1000);
            let embed = this.createEmbed(embedInfo.song, elapsedSeconds);

            if (isPaused) {
                embed.setFooter({ text: '⏸️ Paused' });
            }

            await embedInfo.message.edit({ embeds: [embed] });
        } catch (error) {
            console.error('Error updating now playing:', error.message);
        }
    }

    /**
     * Pause updates (but keep embed visible)
     */
    pause(guildId) {
        const embedInfo = this.activeEmbeds.get(guildId);
        if (!embedInfo) return;

        // Stop interval
        clearInterval(embedInfo.interval);
        
        // Update footer to show paused
        this.updateNow(guildId, true);
    }

    /**
     * Resume updates
     */
    resume(guildId) {
        const embedInfo = this.activeEmbeds.get(guildId);
        if (!embedInfo) return;

        // Restart interval
        const interval = setInterval(async () => {
            const elapsedSeconds = Math.floor((Date.now() - embedInfo.startTime) / 1000);

            if (embedInfo.song.duration > 0 && elapsedSeconds >= embedInfo.song.duration) {
                this.stop(guildId);
                return;
            }

            try {
                const updatedEmbed = this.createEmbed(embedInfo.song, elapsedSeconds);
                await embedInfo.message.edit({ embeds: [updatedEmbed] });
            } catch (error) {
                console.error('Error updating rich now playing:', error.message);
                this.stop(guildId);
            }
        }, this.updateInterval);

        embedInfo.interval = interval;
        this.updateNow(guildId, false);
    }
}

module.exports = RichNowPlaying;
