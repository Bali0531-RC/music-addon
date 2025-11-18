const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getMusicPlayer, config } = require('../music');
const { isBlacklisted } = require('../utils/musicUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName(config.commands.nowplaying.name)
        .setDescription(config.commands.nowplaying.description),
    async execute(interaction) {
        const blacklistCheck = isBlacklisted(interaction.member);
        if (blacklistCheck.blacklisted) {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.error)
                .setDescription(blacklistCheck.reason);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const player = getMusicPlayer(interaction);
        const nowPlaying = player ? player.getNowPlaying() : null;

        if (nowPlaying) {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.info)
                .setTitle(config.messages.now_playing)
                .setDescription(`[${nowPlaying.title}](${nowPlaying.url})`)
                .addFields({ name: config.messages.duration, value: formatDuration(nowPlaying.duration) })
                .setTimestamp();
            interaction.reply({ embeds: [embed] });
        } else {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.warning)
                .setDescription(config.messages.now_playing_empty);
            interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },
};

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}