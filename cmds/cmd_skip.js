const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getMusicPlayer, config } = require('../music');
const { isBlacklisted } = require('../utils/musicUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName(config.commands.skip.name)
        .setDescription(config.commands.skip.description),
    async execute(interaction) {
        const blacklistCheck = isBlacklisted(interaction.member);
        if (blacklistCheck.blacklisted) {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.error)
                .setDescription(blacklistCheck.reason);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const player = getMusicPlayer(interaction);
        if (player) {
            player.skip();
            await interaction.reply({ content: config.ui.success_emoji, ephemeral: true });
        } else {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.warning)
                .setDescription(config.messages.now_playing_empty);
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },
};