const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getMusicPlayer, config } = require('../music');
const { isBlacklisted, checkVoiceChannel, isAdmin } = require('../utils/musicUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName(config.commands.savequeue.name)
        .setDescription(config.commands.savequeue.description),
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

        const player = getMusicPlayer(interaction, false);
        if (!player) {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.error)
                .setDescription('❌ No active music player to save.');
            return interaction.editReply({ embeds: [embed] });
        }

        const success = player.saveQueue();
        
        if (success) {
            const totalSongs = player.queue.length + (player.nowPlaying ? 1 : 0);
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.success)
                .setDescription(`${config.messages.queue_saved} (${totalSongs} songs)`);
            interaction.editReply({ embeds: [embed] });
        } else {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.error)
                .setDescription('❌ Failed to save queue.');
            interaction.editReply({ embeds: [embed] });
        }
    },
};
