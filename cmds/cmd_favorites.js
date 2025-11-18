const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { config, favoritesManager } = require('../music');
const { isBlacklisted } = require('../utils/musicUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName(config.commands.favorites.name)
        .setDescription(config.commands.favorites.description),
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

        const favorites = favoritesManager.getFavorites(interaction.user.id);

        if (favorites.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.info)
                .setDescription(config.messages.favorites_empty);
            return interaction.editReply({ embeds: [embed] });
        }

        const embed = new EmbedBuilder()
            .setColor(config.embed_colors.info)
            .setTitle(`⭐ Your Favorites (${favorites.length})`)
            .setDescription(
                favorites.slice(0, 25).map((song, index) => {
                    return `**${index + 1}.** [${song.title}](${song.url})`;
                }).join('\n')
            );

        if (favorites.length > 25) {
            embed.setFooter({ text: `Showing 25 of ${favorites.length} songs` });
        }

        interaction.editReply({ embeds: [embed] });
    },
};
