const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getMusicPlayer, config } = require('../music');
const { isBlacklisted, checkVoiceChannel } = require('../utils/musicUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName(config.commands.queue.name)
        .setDescription(config.commands.queue.description),
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
        const queue = player ? player.getQueue() : [];
        const nowPlaying = player ? player.getNowPlaying() : null;

        if (queue.length > 0 || nowPlaying) {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.info)
                .setTitle(config.ui.queue_title)
                .setTimestamp();

            if (nowPlaying) {
                embed.addFields({
                    name: `${config.ui.now_playing_emoji} ${config.messages.now_playing}`,
                    value: `[${nowPlaying.title}](${nowPlaying.url})`,
                    inline: false
                });
            }

            if (queue.length > 0) {
                // Build queue list and check length
                let queueList = '';
                let displayCount = 0;
                const maxLength = 900; // Leave room for "...and X more"
                
                for (let i = 0; i < Math.min(queue.length, 15); i++) {
                    const song = queue[i];
                    // Truncate long titles to fit within Discord limits
                    const title = song.title.length > 60 ? song.title.substring(0, 57) + '...' : song.title;
                    const line = `**${i + 1}.** [${title}](${song.url}) - ${formatDuration(song.duration)}\n`;
                    
                    // Check if adding this line would exceed the limit
                    if (queueList.length + line.length > maxLength) {
                        break;
                    }
                    
                    queueList += line;
                    displayCount++;
                }
                
                const queueLabel = queue.length > 1 ? config.ui.song_plural : config.ui.song_singular;
                const remaining = queue.length - displayCount;
                const moreText = remaining > 0 ? '\n*' + config.ui.and_more.replace('{count}', remaining.toString()) + '*' : '';
                
                embed.addFields({
                    name: `${config.ui.up_next_emoji} ${config.ui.up_next_label} (${queue.length} ${queueLabel})`,
                    value: queueList.trimEnd() + moreText,
                    inline: false
                });
            }

            interaction.reply({ embeds: [embed] });
        } else {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.warning)
                .setDescription(config.messages.queue_empty);
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