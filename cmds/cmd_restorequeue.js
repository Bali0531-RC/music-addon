const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getMusicPlayer, config, MusicPlayer } = require('../music');
const { isBlacklisted, checkVoiceChannel } = require('../utils/musicUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName(config.commands.restorequeue.name)
        .setDescription(config.commands.restorequeue.description),
    async execute(interaction) {
        // Check if feature is enabled
        if (!config.features.queue_persistence_enabled) {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.error)
                .setDescription('❌ Queue persistence feature is currently disabled.');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        await interaction.deferReply();

        const blacklistCheck = isBlacklisted(interaction.member);
        if (blacklistCheck.blacklisted) {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.error)
                .setDescription(blacklistCheck.reason);
            return interaction.editReply({ embeds: [embed] });
        }

        const voiceCheck = checkVoiceChannel(interaction, getMusicPlayer, true);
        if (!voiceCheck.allowed) {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.error)
                .setDescription(voiceCheck.reason);
            return interaction.editReply({ embeds: [embed] });
        }

        // Try to restore saved queue
        const state = MusicPlayer.restoreQueue(interaction.guild.id, interaction.client);
        
        if (!state) {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.error)
                .setDescription(config.messages.queue_no_save);
            return interaction.editReply({ embeds: [embed] });
        }

        try {
            // Create or get music player
            const player = getMusicPlayer(interaction, true);
            
            // Restore queue state
            player.queue = state.queue || [];
            player.loop = state.loop || false;
            player.history = state.history || [];
            player.playCount = state.playCount || {};
            
            // If there was a now playing song, add it to front of queue
            if (state.nowPlaying) {
                player.queue.unshift(state.nowPlaying);
            }
            
            const totalSongs = player.queue.length;
            
            // Start playing
            if (totalSongs > 0 && !player.nowPlaying) {
                player.playNext();
            }
            
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.success)
                .setDescription(config.messages.queue_restored.replace('{count}', totalSongs));
            interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Queue restore error:', error);
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.error)
                .setDescription(config.messages.queue_restore_failed);
            interaction.editReply({ embeds: [embed] });
        }
    },
};
