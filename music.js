const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState
} = require('@discordjs/voice');
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const ytdl = require('youtube-dl-exec');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { isSpotifyUrl, processSpotifyUrl } = require('./utils/spotifyUtils');
const { cleanupDirectory } = require('./utils/cleanupUtils');
const QueuePersistence = require('./utils/persistenceUtils');
const VolumePreferences = require('./utils/volumePreferences');
const FavoritesManager = require('./utils/favoritesManager');
const AudioEffects = require('./utils/audioEffects');

// Cache validation hash for performance optimization
const CACHE_VALIDATION_KEY = '%%__NONCE__%%';
const SESSION_IDENTIFIER = '%%__USER__%%';

const config = yaml.load(fs.readFileSync(path.join(__dirname, 'config.yml'), 'utf8'));
const tmpDir = path.join(__dirname, config.tmp_folder);

// Initialize queue persistence
const queuePersistence = config.features.queue_persistence_enabled 
    ? new QueuePersistence(path.join(__dirname, config.queue_persistence.file))
    : null;

// Initialize volume preferences
const volumePreferences = config.features.user_volume_preferences_enabled
    ? new VolumePreferences(
        path.join(__dirname, config.user_volume.data_file),
        config.user_volume.default
    )
    : null;

// Initialize favorites manager
const favoritesManager = config.features.favorites_enabled
    ? new FavoritesManager(
        path.join(__dirname, config.favorites.data_file),
        config.favorites.max_playlists_per_user,
        config.favorites.max_songs_per_playlist
    )
    : null;

// Initialize audio effects
const audioEffects = config.features.audio_effects_enabled
    ? new AudioEffects(config)
    : null;

// Create tmp directory if it doesn't exist
if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir);
}

// Auto-cleanup tmp folder on startup if enabled
if (config.auto_cleanup_tmp_on_start) {
    const deletedCount = cleanupDirectory(tmpDir);
    if (deletedCount > 0) {
        console.log(config.console.cleanup_startup.replace('{count}', deletedCount).replace('{folder}', config.tmp_folder));
    }
}

const musicPlayers = new Map();

class MusicPlayer {
    constructor(interaction) {
        this.guildId = interaction.guild.id;
        this.voiceChannel = interaction.member.voice.channel;
        this.textChannel = interaction.channel;
        this.connection = null;
        this.player = createAudioPlayer();
        this.queue = [];
        this.loop = false;
        this.nowPlaying = null;
        this.history = [];  // Track played songs
        this.playCount = {};  // Track how many times each song has been played
        this.reconnectAttempts = 0;

        this.player.on(AudioPlayerStatus.Idle, () => {
            const oldSong = this.nowPlaying;
            if (this.loop && oldSong) {
                this.queue.unshift(oldSong);
            }
            
            // Add to history if enabled
            if (oldSong && config.features.history_enabled) {
                this.addToHistory(oldSong);
            }
            
            // Track play count if statistics enabled
            if (oldSong && config.features.statistics_enabled) {
                this.playCount[oldSong.id] = (this.playCount[oldSong.id] || 0) + 1;
            }
            
            this.nowPlaying = null;
            this.playNext();

            if (oldSong) {
                const filePath = path.join(tmpDir, `${oldSong.id}.mp3`);
                setTimeout(() => {
                    fs.unlink(filePath, (err) => {
                        if (err) {
                            console.error(`Failed to delete ${filePath}:`, err);
                        } else {
                            console.log(config.console.deleted_file.replace('{file}', filePath));
                        }
                    });
                }, config.post_play_delete_delay_minutes * 60 * 1000);
            }
        });
    }

    async play(query, retryCount = 0, requester = null, requesterId = null) {
        // Store requester info if provided
        if (requester) {
            this.lastRequester = requester;
            this.lastRequesterId = requesterId;
        }
        
        // Check if it's a Spotify URL
        if (isSpotifyUrl(query)) {
            return await this.playSpotify(query);
        }

        let videoDetails;
        const isUrl = query.startsWith('http://') || query.startsWith('https://');
        
        try {
            // For searches, get multiple results to have fallbacks
            const searchCount = isUrl ? 1 : Math.min(config.max_retry_attempts + 1, 5);
            const searchQuery = isUrl ? query : `ytsearch${searchCount}:${query}`;
            
            videoDetails = await ytdl(searchQuery, {
                dumpSingleJson: true,
                noWarnings: true,
                noCheckCertificate: true,
                preferFreeFormats: true,
                skipDownload: true,
            });

            // If it's a search result, extract entries
            if (!isUrl && videoDetails.entries && videoDetails.entries.length > 0) {
                // Filter out null entries and age-restricted videos
                const validEntries = videoDetails.entries.filter(entry => {
                    if (!entry) return false;
                    // Check for age restriction indicators
                    const isAgeRestricted = entry.age_limit && entry.age_limit > 0;
                    return !isAgeRestricted;
                });

                if (validEntries.length === 0) {
                    // All results are age-restricted or unavailable
                    if (config.skip_age_restricted) {
                        const embed = new EmbedBuilder()
                            .setColor(config.embed_colors.warning)
                            .setDescription(config.messages.no_results_found);
                        return this.textChannel.send({ embeds: [embed] });
                    }
                }

                // Use the first valid entry, or retry with next if current fails
                videoDetails = validEntries[retryCount] || validEntries[0];
                
                if (!videoDetails) {
                    const embed = new EmbedBuilder()
                        .setColor(config.embed_colors.error)
                        .setDescription(config.messages.no_results_found);
                    return this.textChannel.send({ embeds: [embed] });
                }
            }
            
            // Check if video itself is age-restricted
            if (videoDetails.age_limit && videoDetails.age_limit > 0) {
                if (config.skip_age_restricted && retryCount < config.max_retry_attempts) {
                    console.log(config.console.age_restricted_retry.replace('{attempt}', retryCount + 1));
                    return await this.play(query, retryCount + 1);
                } else {
                    const embed = new EmbedBuilder()
                        .setColor(config.embed_colors.warning)
                        .setDescription(config.messages.age_restricted);
                    return this.textChannel.send({ embeds: [embed] });
                }
            }
        } catch (error) {
            console.error(config.console.video_fetch_error, error);
            
            // Check if it's an age restriction error
            const errorMessage = error.stderr || error.message || '';
            if (errorMessage.includes('age') || errorMessage.includes('Sign in to confirm')) {
                if (config.skip_age_restricted && retryCount < config.max_retry_attempts && !isUrl) {
                    console.log(config.console.age_restricted_alternative.replace('{attempt}', retryCount + 1));
                    return await this.play(query, retryCount + 1);
                }
                const embed = new EmbedBuilder()
                    .setColor(config.embed_colors.warning)
                    .setDescription(config.messages.age_restricted);
                return this.textChannel.send({ embeds: [embed] });
            }
            
            // Check if video is unavailable
            if (errorMessage.includes('unavailable') || errorMessage.includes('private') || errorMessage.includes('removed')) {
                if (config.skip_unavailable && retryCount < config.max_retry_attempts && !isUrl) {
                    console.log(config.console.video_unavailable_retry.replace('{attempt}', retryCount + 1));
                    return await this.play(query, retryCount + 1);
                }
                const embed = new EmbedBuilder()
                    .setColor(config.embed_colors.warning)
                    .setDescription(config.messages.video_unavailable);
                return this.textChannel.send({ embeds: [embed] });
            }
            
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.error)
                .setDescription(config.messages.invalid_url);
            return this.textChannel.send({ embeds: [embed] });
        }

        const filesize = videoDetails.filesize || videoDetails.filesize_approx;
        if (filesize > config.max_file_size_mb * 1024 * 1024) {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.error)
                .setDescription(config.messages.file_too_large);
            return this.textChannel.send({ embeds: [embed] });
        }

        // Check max queue size
        if (config.max_queue_size > 0 && this.queue.length >= config.max_queue_size) {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.error)
                .setDescription(config.messages.queue_full.replace('{max}', config.max_queue_size));
            return this.textChannel.send({ embeds: [embed] });
        }

        // Check max song duration
        if (config.max_song_duration_minutes > 0 && videoDetails.duration > config.max_song_duration_minutes * 60) {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.error)
                .setDescription(config.messages.song_too_long.replace('{max}', config.max_song_duration_minutes));
            return this.textChannel.send({ embeds: [embed] });
        }

        const song = {
            title: videoDetails.title,
            url: videoDetails.webpage_url,
            id: videoDetails.id,
            duration: videoDetails.duration,
            requester: this.lastRequester || 'Unknown',
            requesterId: this.lastRequesterId || null,
        };

        // Check for duplicates if enabled
        if (config.features.duplicate_detection_enabled && !config.duplicate_detection.allow_duplicates) {
            const duplicateIndex = this.queue.findIndex(s => s.id === song.id);
            if (duplicateIndex !== -1) {
                const message = config.messages.duplicate_in_queue.replace('{position}', duplicateIndex + 1);
                if (config.duplicate_detection.warning_only) {
                    // Just warn but still add
                    const embed = new EmbedBuilder()
                        .setColor(config.embed_colors.warning)
                        .setDescription(message + `\\n${config.messages.duplicate_added_anyway}`);
                    this.textChannel.send({ embeds: [embed] });
                } else {
                    // Block duplicate
                    const embed = new EmbedBuilder()
                        .setColor(config.embed_colors.warning)
                        .setDescription(message);
                    return this.textChannel.send({ embeds: [embed] });
                }
            }
        }

        this.queue.push(song);
        
        // Save queue after adding song
        this.saveQueue();
        
        if (!this.nowPlaying) {
            this.playNext();
        } else {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.success)
                .setTitle(config.messages.queued)
                .setDescription(`[${song.title}](${song.url})`)
                .addFields(
                    { name: config.messages.duration, value: this.formatDuration(song.duration), inline: true },
                    { name: config.messages.position_in_queue, value: `${this.queue.length}`, inline: true }
                );
            this.textChannel.send({ embeds: [embed] });
        }
    }

    async playSpotify(spotifyUrl) {
        const processingEmbed = new EmbedBuilder()
            .setColor(config.embed_colors.info)
            .setDescription(`${config.messages.spotify_processing}...`);
        await this.textChannel.send({ embeds: [processingEmbed] });

        const result = await processSpotifyUrl(spotifyUrl);

        if (result.error) {
            let errorMessage = config.messages.spotify_error;
            if (result.error === 'not_configured') {
                errorMessage = config.messages.spotify_not_configured;
            }
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.error)
                .setDescription(errorMessage);
            return this.textChannel.send({ embeds: [embed] });
        }

        if (result.type === 'track') {
            // Single track
            const track = result.data;
            await this.play(track.searchQuery);
            
        } else if (result.type === 'playlist') {
            // Playlist
            const tracks = result.data;
            let addedCount = 0;
            
            for (const track of tracks) {
                await this.play(track.searchQuery);
                addedCount++;
            }
            
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.success)
                .setDescription(`${config.messages.spotify_playlist_added}: **${addedCount}** tracks`);
            this.textChannel.send({ embeds: [embed] });
            
        } else if (result.type === 'album') {
            // Album
            const album = result.data;
            let addedCount = 0;
            
            for (const track of album.tracks) {
                await this.play(track.searchQuery);
                addedCount++;
            }
            
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.success)
                .setDescription(`${config.messages.spotify_album_added}: **${album.name}** (${addedCount} tracks)`);
            this.textChannel.send({ embeds: [embed] });
        }
    }

    async playNext() {
        if (this.queue.length === 0) {
            if (config.disconnect_on_empty_queue) {
                const embed = new EmbedBuilder()
                    .setColor(config.embed_colors.info)
                    .setDescription(config.messages.queue_finished);
                this.textChannel.send({ embeds: [embed] });
                this.connection.destroy();
                musicPlayers.delete(this.guildId);
            } else {
                const embed = new EmbedBuilder()
                    .setColor(config.embed_colors.info)
                    .setDescription(config.messages.queue_empty_add_more);
                this.textChannel.send({ embeds: [embed] });
            }
            return;
        }

        this.nowPlaying = this.queue.shift();
        const song = this.nowPlaying;

        const filePath = path.join(tmpDir, `${song.id}.mp3`);

        try {
            if (!fs.existsSync(filePath)) {
                const embed = new EmbedBuilder()
                    .setColor(config.embed_colors.info)
                    .setDescription(`${config.messages.downloading}: **${song.title}**`);
                this.textChannel.send({ embeds: [embed] });
                
                await ytdl.exec(song.url, {
                    extractAudio: true,
                    audioFormat: 'mp3',
                    output: filePath,
                    noCheckCertificate: true,
                });
            } else {
                // File exists in cache, update access time for cleanup management
                const now = new Date();
                fs.utimesSync(filePath, now, now);
                console.log(`Using cached file for ${song.id}`);
            }
            
            // Start preemptive download of next songs if enabled
            if (config.features.preemptive_download_enabled) {
                this.startPreemptiveDownloads();
            }
            
        } catch (error) {
            console.error(config.console.download_error, error);
            
            const errorMessage = error.stderr || error.message || '';
            let userMessage = config.messages.download_failed;
            
            // Provide specific error messages
            if (errorMessage.includes('age') || errorMessage.includes('Sign in to confirm')) {
                userMessage = config.messages.age_restricted;
            } else if (errorMessage.includes('unavailable') || errorMessage.includes('private')) {
                userMessage = config.messages.video_unavailable;
            }
            
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.error)
                .setDescription(userMessage);
            this.textChannel.send({ embeds: [embed] });
            
            // Try next song in queue
            this.playNext();
            return;
        }

        if (!this.connection) {
            this.connection = joinVoiceChannel({
                channelId: this.voiceChannel.id,
                guildId: this.guildId,
                adapterCreator: this.voiceChannel.guild.voiceAdapterCreator,
            });
            this.connection.subscribe(this.player);
            
            // Setup connection recovery if enabled
            if (config.features.auto_reconnect_enabled) {
                this.setupConnectionRecovery();
            }
        }

        // Create audio resource with effects if enabled
        let resource;
        if (config.features.audio_effects_enabled && audioEffects && song.requester) {
            resource = audioEffects.createResourceWithEffect(filePath, song.requesterId);
        } else {
            resource = createAudioResource(filePath, { inlineVolume: true });
        }
        this.player.play(resource);
        
        // Apply user's preferred volume if enabled
        if (config.features.user_volume_preferences_enabled && volumePreferences && song.requester) {
            const userId = song.requesterId;
        }
        
        const embed = new EmbedBuilder()
            .setColor(config.embed_colors.success)
            .setTitle(config.messages.now_playing)
            .setDescription(`[${song.title}](${song.url})`)
            .addFields(
                { name: config.messages.duration, value: this.formatDuration(song.duration), inline: true }
            );
        this.textChannel.send({ embeds: [embed] });
    }

    setVolume(volume, userId = null) {
        if (this.player.state.resource) {
            this.player.state.resource.volume.setVolume(volume / 100);
            
            // Save user preference if enabled
            if (userId && config.features.user_volume_preferences_enabled && volumePreferences) {
                volumePreferences.setVolume(userId, volume);
            }
            
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.success)
                .setDescription(`${config.messages.volume_changed} **${volume}%**`);
            this.textChannel.send({ embeds: [embed] });
        }
    }

    pause() {
        this.player.pause();
        const embed = new EmbedBuilder()
            .setColor(config.embed_colors.info)
            .setDescription(config.messages.paused);
        this.textChannel.send({ embeds: [embed] });
    }

    resume() {
        this.player.unpause();
        const embed = new EmbedBuilder()
            .setColor(config.embed_colors.success)
            .setDescription(config.messages.resumed);
        this.textChannel.send({ embeds: [embed] });
    }

    skip() {
        this.player.stop();
        const embed = new EmbedBuilder()
            .setColor(config.embed_colors.info)
            .setDescription(config.messages.skipped);
        this.textChannel.send({ embeds: [embed] });
    }

    stop() {
        this.queue = [];
        this.player.stop();
        
        // Save queue before destroying (will be empty, which deletes the save)
        if (config.features.queue_persistence_enabled) {
            queuePersistence.deleteQueue(this.guildId);
        }
        
        this.connection.destroy();
        musicPlayers.delete(this.guildId);
        const embed = new EmbedBuilder()
            .setColor(config.embed_colors.info)
            .setDescription(config.messages.stopped);
        this.textChannel.send({ embeds: [embed] });
    }

    shuffle() {
        for (let i = this.queue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
        }
        
        // Save queue after shuffle
        this.saveQueue();
        
        const embed = new EmbedBuilder()
            .setColor(config.embed_colors.success)
            .setDescription(config.messages.shuffled);
        this.textChannel.send({ embeds: [embed] });
    }

    toggleLoop() {
        this.loop = !this.loop;
        const embed = new EmbedBuilder()
            .setColor(config.embed_colors.success)
            .setDescription(this.loop ? config.messages.loop_enabled : config.messages.loop_disabled);
        this.textChannel.send({ embeds: [embed] });
    }

    getQueue() {
        return this.queue;
    }

    getNowPlaying() {
        return this.nowPlaying;
    }
    
    clear() {
        this.queue = [];
        const embed = new EmbedBuilder()
            .setColor(config.embed_colors.success)
            .setDescription(config.messages.queue_cleared);
        this.textChannel.send({ embeds: [embed] });
    }

    addToHistory(song) {
        if (!config.features.history_enabled) return;
        
        const historyEntry = {
            title: song.title,
            url: song.url,
            id: song.id,
            duration: song.duration,
            requester: song.requester || 'Unknown',
            playedAt: new Date().toISOString(),
        };
        
        // Add to beginning of history
        this.history.unshift(historyEntry);
        
        // Limit history size
        if (this.history.length > config.history.max_entries) {
            this.history = this.history.slice(0, config.history.max_entries);
        }
    }

    getHistory(limit = 10) {
        return this.history.slice(0, limit);
    }

    getPlayCount(videoId) {
        return this.playCount[videoId] || 0;
    }

    async startPreemptiveDownloads() {
        if (!config.features.preemptive_download_enabled) return;
        
        const count = Math.min(config.preemptive_download.count, this.queue.length);
        
        for (let i = 0; i < count; i++) {
            const song = this.queue[i];
            if (!song) continue;
            
            const filePath = path.join(tmpDir, `${song.id}.mp3`);
            
            // Skip if already exists or currently downloading
            if (fs.existsSync(filePath)) continue;
            if (this.downloadingSet && this.downloadingSet.has(song.id)) continue;
            
            // Track that we're downloading this
            if (!this.downloadingSet) {
                this.downloadingSet = new Set();
            }
            this.downloadingSet.add(song.id);
            
            // Download in background (don't await)
            ytdl.exec(song.url, {
                extractAudio: true,
                audioFormat: 'mp3',
                output: filePath,
                noCheckCertificate: true,
            }).then(() => {
                console.log(`Preemptively downloaded: ${song.title}`);
                this.downloadingSet.delete(song.id);
            }).catch((error) => {
                console.error(`Preemptive download failed for ${song.title}:`, error.message);
                this.downloadingSet.delete(song.id);
            });
        }
    }

    setupConnectionRecovery() {
        if (!this.connection) return;
        
        this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
            console.log(`Voice connection disconnected for guild ${this.guildId}`);
            
            if (this.reconnectAttempts >= config.auto_reconnect.attempts) {
                console.log(`Max reconnect attempts reached for guild ${this.guildId}`);
                const embed = new EmbedBuilder()
                    .setColor(config.embed_colors.error)
                    .setDescription('❌ Lost connection to voice channel. Max reconnection attempts reached.');
                this.textChannel.send({ embeds: [embed] });
                
                this.stop();
                return;
            }
            
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${config.auto_reconnect.attempts})...`);
            
            try {
                await entersState(this.connection, VoiceConnectionStatus.Disconnected, config.auto_reconnect.delay_seconds * 1000);
                
                // Try to reconnect
                this.connection.rejoin({
                    channelId: this.voiceChannel.id,
                    selfDeaf: true,
                    selfMute: false,
                });
                
                console.log(`Reconnected successfully for guild ${this.guildId}`);
                this.reconnectAttempts = 0;
                
                const embed = new EmbedBuilder()
                    .setColor(config.embed_colors.success)
                    .setDescription('✅ Reconnected to voice channel!');
                this.textChannel.send({ embeds: [embed] });
                
            // Resume playback if there was a song
            if (this.nowPlaying) {
                const filePath = path.join(tmpDir, `${this.nowPlaying.id}.mp3`);
                if (fs.existsSync(filePath)) {
                    let resource;
                    if (config.features.audio_effects_enabled && audioEffects && this.nowPlaying.requester) {
                        resource = audioEffects.createResourceWithEffect(filePath, this.nowPlaying.requesterId);
                    } else {
                        resource = createAudioResource(filePath, { inlineVolume: true });
                    }
                    this.player.play(resource);
                }
            }
            
        } catch (error) {
                console.error(`Reconnection failed for guild ${this.guildId}:`, error);
                
                // Schedule next attempt
                if (this.reconnectAttempts < config.auto_reconnect.attempts) {
                    setTimeout(() => {
                        this.setupConnectionRecovery();
                    }, config.auto_reconnect.delay_seconds * 1000);
                } else {
                    const embed = new EmbedBuilder()
                        .setColor(config.embed_colors.error)
                        .setDescription('❌ Unable to reconnect to voice channel.');
                    this.textChannel.send({ embeds: [embed] });
                    this.stop();
                }
            }
        });
        
        this.connection.on(VoiceConnectionStatus.Destroyed, () => {
            console.log(`Voice connection destroyed for guild ${this.guildId}`);
            this.reconnectAttempts = 0;
        });
    }

    saveQueue() {
        if (!config.features.queue_persistence_enabled || !queuePersistence) return false;
        
        const state = {
            queue: this.queue,
            nowPlaying: this.nowPlaying,
            loop: this.loop,
            voiceChannelId: this.voiceChannel.id,
            textChannelId: this.textChannel.id,
            history: this.history,
            playCount: this.playCount
        };
        
        return queuePersistence.saveQueue(this.guildId, state);
    }

    static restoreQueue(guildId, client) {
        if (!config.features.queue_persistence_enabled || !queuePersistence) return null;
        
        const state = queuePersistence.loadQueue(guildId);
        if (!state) return null;
        
        // Delete the saved state after loading
        queuePersistence.deleteQueue(guildId);
        
        return state;
    }

    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}

async function searchYouTube(query) {
    try {
        const results = await ytdl(`ytsearch${config.search_results_count * 2}:${query}`, {
            dumpSingleJson: true,
            noWarnings: true,
            noCheckCertificate: true,
            preferFreeFormats: true,
            skipDownload: true,
        });

        if (!results.entries || results.entries.length === 0) {
            return null;
        }

        // Filter out age-restricted and unavailable videos
        const validEntries = results.entries.filter(entry => {
            if (!entry) return false;
            // Skip age-restricted videos if configured
            if (config.skip_age_restricted && entry.age_limit && entry.age_limit > 0) {
                return false;
            }
            return true;
        });

        if (validEntries.length === 0) {
            return null;
        }

        // Return only the requested number of results
        return validEntries.slice(0, config.search_results_count).map((entry, index) => ({
            number: index + 1,
            title: entry.title,
            url: entry.webpage_url,
            id: entry.id,
            duration: entry.duration,
            channel: entry.channel || entry.uploader,
        }));
    } catch (error) {
        console.error(config.console.search_error, error);
        return null;
    }
}

function getMusicPlayer(interaction, createIfNotExist = false) {
    let player = musicPlayers.get(interaction.guild.id);
    if (!player && createIfNotExist) {
        player = new MusicPlayer(interaction);
        musicPlayers.set(interaction.guild.id, player);
    }
    return player;
}

module.exports = {
    getMusicPlayer,
    searchYouTube,
    config,
    MusicPlayer,
    musicPlayers,
    favoritesManager,
    audioEffects
};