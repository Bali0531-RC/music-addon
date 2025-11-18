const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getMusicPlayer, config, favoritesManager } = require('../music');
const { isBlacklisted } = require('../utils/musicUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName(config.commands.favorite.name)
        .setDescription(config.commands.favorite.description),
    async execute(interaction) {
        // Check if feature is enabled
        if (!config.features.favorites_enabled) {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.error)
                .setDescription('❌ Favorites feature is currently disabled.');
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
        if (!player || !player.getNowPlaying()) {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.error)
                .setDescription('❌ No song currently playing to favorite.');
            return interaction.editReply({ embeds: [embed] });
        }

        const nowPlaying = player.getNowPlaying();
        const result = favoritesManager.addFavorite(interaction.user.id, nowPlaying);

        if (result.success) {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.success)
                .setTitle(config.messages.favorite_added)
                .setDescription(`[${nowPlaying.title}](${nowPlaying.url})`);
            interaction.editReply({ embeds: [embed] });
        } else {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.warning)
                .setDescription(config.messages.favorite_already_exists);
            interaction.editReply({ embeds: [embed] });
        }
    },
};
