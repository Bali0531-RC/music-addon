const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getMusicPlayer, config } = require('../music');
const { isBlacklisted, checkVoiceChannel } = require('../utils/musicUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName(config.commands.history.name)
        .setDescription(config.commands.history.description)
        .addIntegerOption(option =>
            option.setName('limit')
            .setDescription(config.commands.history.option_limit)
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(50)),
    async execute(interaction) {
        // Check if feature is enabled
        if (!config.features.history_enabled) {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.error)
                .setDescription('❌ History feature is currently disabled.');
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
                .setDescription(config.messages.history_empty);
            return interaction.editReply({ embeds: [embed] });
        }

        const limit = interaction.options.getInteger('limit') || 10;
        const history = player.getHistory(limit);

        if (history.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.info)
                .setDescription(config.messages.history_empty);
            return interaction.editReply({ embeds: [embed] });
        }

        const embed = new EmbedBuilder()
            .setColor(config.embed_colors.info)
            .setTitle(config.messages.history_title)
            .setDescription(
                history.map((song, index) => {
                    let line = `**${index + 1}.** [${song.title}](${song.url})`;
                    if (config.history.show_requester) {
                        line += ` - ${song.requester}`;
                    }
                    return line;
                }).join('\n')
            )
            .setFooter({ text: `Showing ${history.length} of ${player.history.length} songs` });

        interaction.editReply({ embeds: [embed] });
    },
};
