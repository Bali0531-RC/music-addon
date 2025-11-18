const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getMusicPlayer, config } = require('../music');
const { isBlacklisted, checkVoiceChannel } = require('../utils/musicUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName(config.commands.volume.name)
        .setDescription(config.commands.volume.description)
        .addIntegerOption(option =>
            option.setName('level')
            .setDescription(config.commands.volume.option_level)
            .setRequired(true)),
    async execute(interaction) {
        const blacklistCheck = isBlacklisted(interaction.member);
        if (blacklistCheck.blacklisted) {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.error)
                .setDescription(blacklistCheck.reason);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const voiceCheck = checkVoiceChannel(interaction, getMusicPlayer);
        if (!voiceCheck.allowed) {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.error)
                .setDescription(voiceCheck.reason);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const player = getMusicPlayer(interaction);
        if (player) {
            const volume = interaction.options.getInteger('level');
            if (volume >= 0 && volume <= 100) {
                player.setVolume(volume, interaction.user.id);
                
                let message = config.ui.success_emoji;
                if (config.features.user_volume_preferences_enabled) {
                    message += ' Volume preference saved!';
                }
                
                await interaction.reply({ content: message, ephemeral: true });
            } else {
                const embed = new EmbedBuilder()
                    .setColor(config.embed_colors.error)
                    .setDescription(config.ui.volume_range_error);
                await interaction.reply({ embeds: [embed], ephemeral: true });
            }
        } else {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.warning)
                .setDescription(config.messages.now_playing_empty);
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },
};