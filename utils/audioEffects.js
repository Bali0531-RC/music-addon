const { createAudioResource } = require('@discordjs/voice');
const prism = require('prism-media');
const { createReadStream } = require('fs');

/**
 * Audio Effects Manager
 * Provides real-time audio filters using FFmpeg
 */
class AudioEffects {
    constructor(config) {
        this.config = config;
        this.enabled = config.audio_effects?.enabled ?? false;
        this.availableEffects = config.audio_effects?.available_effects ?? [];
        
        // Effect configurations with FFmpeg filter strings
        this.effects = {
            nightcore: {
                name: 'Nightcore',
                filter: 'aresample=48000,asetrate=48000*1.25,aresample=48000,atempo=1.06',
                description: 'Speeds up tempo and raises pitch'
            },
            bassboost: {
                name: 'Bass Boost',
                filter: 'bass=g=10',
                description: 'Amplifies low frequencies'
            },
            '8d': {
                name: '8D Audio',
                filter: 'apulsator=hz=0.125',
                description: 'Creates surround sound effect'
            },
            vaporwave: {
                name: 'Vaporwave',
                filter: 'aresample=48000,asetrate=48000*0.8,aresample=48000,atempo=1.1',
                description: 'Slows down tempo and lowers pitch'
            },
            treble: {
                name: 'Treble Boost',
                filter: 'treble=g=5',
                description: 'Amplifies high frequencies'
            },
            echo: {
                name: 'Echo',
                filter: 'aecho=0.8:0.9:1000:0.3',
                description: 'Adds echo effect'
            },
            reverb: {
                name: 'Reverb',
                filter: 'aecho=0.8:0.88:60:0.4',
                description: 'Adds reverb/hall effect'
            },
            chipmunk: {
                name: 'Chipmunk',
                filter: 'aresample=48000,asetrate=48000*1.5,aresample=48000',
                description: 'High-pitched voice effect'
            },
            deepvoice: {
                name: 'Deep Voice',
                filter: 'aresample=48000,asetrate=48000*0.7,aresample=48000',
                description: 'Low-pitched voice effect'
            },
            distortion: {
                name: 'Distortion',
                filter: 'acompressor=threshold=0.089:ratio=9:attack=200:release=1000',
                description: 'Adds distortion effect'
            },
            tremolo: {
                name: 'Tremolo',
                filter: 'tremolo=f=5:d=0.5',
                description: 'Rapid volume variation'
            },
            vibrato: {
                name: 'Vibrato',
                filter: 'vibrato=f=5:d=0.5',
                description: 'Pitch oscillation effect'
            }
        };

        // User effect preferences (userId -> effectId)
        this.userEffects = new Map();
    }

    /**
     * Check if a specific effect is available
     */
    isEffectAvailable(effectId) {
        if (!this.enabled) return false;
        return this.availableEffects.includes(effectId) && this.effects.hasOwnProperty(effectId);
    }

    /**
     * Get all available effects
     */
    getAvailableEffects() {
        if (!this.enabled) return [];
        
        return this.availableEffects
            .filter(id => this.effects.hasOwnProperty(id))
            .map(id => ({
                id,
                name: this.effects[id].name,
                description: this.effects[id].description
            }));
    }

    /**
     * Get effect details
     */
    getEffect(effectId) {
        if (!this.isEffectAvailable(effectId)) return null;
        return {
            id: effectId,
            ...this.effects[effectId]
        };
    }

    /**
     * Set user's preferred effect
     */
    setUserEffect(userId, effectId) {
        if (effectId === null || effectId === 'none') {
            this.userEffects.delete(userId);
            return true;
        }

        if (!this.isEffectAvailable(effectId)) {
            return false;
        }

        this.userEffects.set(userId, effectId);
        return true;
    }

    /**
     * Get user's current effect
     */
    getUserEffect(userId) {
        return this.userEffects.get(userId) || null;
    }

    /**
     * Create audio resource with effect applied
     */
    createResourceWithEffect(filePath, userId, volume = 1.0) {
        const effectId = this.getUserEffect(userId);
        
        // No effect or effects disabled - return normal resource
        if (!effectId || !this.enabled) {
            return createAudioResource(createReadStream(filePath), {
                inlineVolume: true,
                inputType: 'arbitrary'
            });
        }

        const effect = this.effects[effectId];
        if (!effect) {
            return createAudioResource(createReadStream(filePath), {
                inlineVolume: true,
                inputType: 'arbitrary'
            });
        }

        // Create FFmpeg process with effect filter
        const ffmpeg = new prism.FFmpeg({
            args: [
                '-i', filePath,
                '-af', effect.filter,
                '-analyzeduration', '0',
                '-loglevel', '0',
                '-f', 's16le',
                '-ar', '48000',
                '-ac', '2'
            ]
        });

        return createAudioResource(ffmpeg, {
            inputType: 'raw',
            inlineVolume: true
        });
    }

    /**
     * Get FFmpeg filter string for effect
     */
    getFilterString(effectId) {
        if (!this.isEffectAvailable(effectId)) return null;
        return this.effects[effectId].filter;
    }

    /**
     * Combine multiple effects
     */
    combineEffects(effectIds) {
        if (!this.enabled) return null;
        
        const filters = effectIds
            .filter(id => this.isEffectAvailable(id))
            .map(id => this.effects[id].filter);
        
        if (filters.length === 0) return null;
        return filters.join(',');
    }

    /**
     * Check if FFmpeg is available
     */
    async checkFFmpegAvailable() {
        try {
            const { spawn } = require('child_process');
            return new Promise((resolve) => {
                const ffmpeg = spawn('ffmpeg', ['-version']);
                ffmpeg.on('error', () => resolve(false));
                ffmpeg.on('close', (code) => resolve(code === 0));
            });
        } catch (error) {
            return false;
        }
    }

    /**
     * Format effect list for display
     */
    formatEffectList() {
        const effects = this.getAvailableEffects();
        if (effects.length === 0) return 'No effects available';
        
        return effects.map(e => `**${e.name}** (\`${e.id}\`)\n${e.description}`).join('\n\n');
    }
}

module.exports = AudioEffects;
