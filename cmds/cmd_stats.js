const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getMusicPlayer, config, musicPlayers } = require('../music');
const { isBlacklisted } = require('../utils/musicUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName(config.commands.stats.name)
        .setDescription(config.commands.stats.description)
        .addStringOption(option =>
            option.setName('type')
            .setDescription(config.commands.stats.option_type)
            .setRequired(false)
            .addChoices(
                { name: 'Server Stats', value: 'server' },
                { name: 'Personal Stats', value: 'personal' },
                { name: 'Top Songs', value: 'top' }
            )),
    async execute(interaction) {
        // Check if feature is enabled
        if (!config.features.statistics_enabled) {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.error)
                .setDescription('❌ Statistics feature is currently disabled.');
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

        const type = interaction.options.getString('type') || 'server';
        const player = getMusicPlayer(interaction, false);

        if (!player) {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.info)
                .setDescription(config.messages.stats_no_data);
            return interaction.editReply({ embeds: [embed] });
        }

        const embed = new EmbedBuilder()
            .setColor(config.embed_colors.info);

        if (type === 'server') {
            const totalPlayed = player.history.length;
            const queueSize = player.queue.length;
            const uniqueSongs = new Set(player.history.map(s => s.id)).size;
            
            let topRequesters = {};
            player.history.forEach(song => {
                topRequesters[song.requester] = (topRequesters[song.requester] || 0) + 1;
            });
            
            const topRequestersList = Object.entries(topRequesters)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([ name, count], index) => `${index + 1}. ${name}: **${count}** songs`)
                .join('\n') || 'No data yet';

            embed.setTitle(config.messages.stats_title)
                .addFields(
                    { name: '🎵 Total Songs Played', value: totalPlayed.toString(), inline: true },
                    { name: '📋 Current Queue Size', value: queueSize.toString(), inline: true },
                    { name: '🎼 Unique Songs', value: uniqueSongs.toString(), inline: true },
                    { name: '👥 Top Requesters', value: topRequestersList, inline: false }
                );

        } else if (type === 'personal') {
            const userName = interaction.user.tag;
            const userSongs = player.history.filter(s => s.requester === userName);
            const totalPlayed = userSongs.length;
            
            const topSongs = {};
            userSongs.forEach(song => {
                topSongs[song.id] = {
                    title: song.title,
                    url: song.url,
                    count: (topSongs[song.id]?.count || 0) + 1
                };
            });
            
            const topSongsList = Object.values(topSongs)
                .sort((a, b) => b.count - a.count)
                .slice(0, 5)
                .map((song, index) => `${index + 1}. [${song.title}](${song.url}) - **${song.count}** plays`)
                .join('\n') || 'No songs played yet';

            embed.setTitle(config.messages.stats_personal_title)
                .addFields(
                    { name: '🎵 Songs You\'ve Requested', value: totalPlayed.toString(), inline: true },
                    { name: '🌟 Your Top Songs', value: topSongsList, inline: false }
                );

        } else if (type === 'top') {
            const songCounts = {};
            player.history.forEach(song => {
                if (!songCounts[song.id]) {
                    songCounts[song.id] = {
                        title: song.title,
                        url: song.url,
                        count: 0
                    };
                }
                songCounts[song.id].count++;
            });

            const topSongs = Object.values(songCounts)
                .sort((a, b) => b.count - a.count)
                .slice(0, config.statistics.leaderboard_size)
                .map((song, index) => `**${index + 1}.** [${song.title}](${song.url}) - **${song.count}** plays`)
                .join('\n') || 'No songs played yet';

            embed.setTitle('🏆 Top Songs')
                .setDescription(topSongs);
        }

        interaction.editReply({ embeds: [embed] });
    },
};
