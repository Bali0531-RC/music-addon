const { SlashCommandBuilder } = require('discord.js');
const { EmbedBuilder } = require('discord.js');
const { getMusicPlayer, config, lyricsFetcher } = require('../music.js');
const { checkBlacklist } = require('../utils/blacklistUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName(config.commands.lyrics.name)
        .setDescription(config.commands.lyrics.description)
        .addStringOption(option =>
            option
                .setName('query')
                .setDescription('Song name or leave empty for current song')
                .setRequired(false)
        ),

    async execute(interaction) {
        // Feature flag check
        if (!config.features.lyrics_enabled) {
            return await interaction.reply({
                content: config.messages.feature_disabled || '❌ This feature is currently disabled.',
                ephemeral: true
            });
        }

        // Blacklist check
        if (!(await checkBlacklist(interaction))) {
            return;
        }

        if (!lyricsFetcher) {
            return await interaction.reply({
                content: '❌ Lyrics system is not initialized.',
                ephemeral: true
            });
        }

        if (!lyricsFetcher.isConfigured()) {
            return await interaction.reply({
                content: config.messages.lyrics_not_configured || '❌ Lyrics feature is not configured. Please add your Genius API key to config.yml.',
                ephemeral: true
            });
        }

        const query = interaction.options.getString('query');
        
        // If no query provided, use current playing song
        if (!query) {
            const player = getMusicPlayer(interaction.guildId);
            
            if (!player) {
                return await interaction.reply({
                    content: config.messages.no_player || '❌ No music is playing.',
                    ephemeral: true
                });
            }

            const nowPlaying = player.getNowPlaying();
            
            if (!nowPlaying) {
                return await interaction.reply({
                    content: config.messages.no_song_playing || '❌ No song is currently playing.',
                    ephemeral: true
                });
            }

            await interaction.deferReply();

            // Parse song info from YouTube title
            const { title, artist } = lyricsFetcher.parseSongInfo(nowPlaying.title);
            
            try {
                const result = await lyricsFetcher.fetchLyrics(title, artist);
                
                if (!result.success) {
                    return await interaction.editReply({
                        content: config.messages.lyrics_not_found || `❌ ${result.error || 'Lyrics not found.'}`
                    });
                }

                const embed = new EmbedBuilder()
                    .setColor(config.embed_colors.info)
                    .setTitle(`🎵 ${result.title}`)
                    .setDescription(config.messages.lyrics_found || 'Lyrics information found!')
                    .addFields(
                        { name: '🎤 Artist', value: result.artist, inline: true },
                        { name: '🔗 View Lyrics', value: `[Click here](${result.url})`, inline: true }
                    );

                if (result.releaseDate) {
                    embed.addFields({ name: '📅 Release Date', value: result.releaseDate, inline: true });
                }

                if (result.thumbnail) {
                    embed.setThumbnail(result.thumbnail);
                }

                embed.setFooter({ 
                    text: config.messages.lyrics_footer || 'Data from Genius • Visit link to view full lyrics'
                });

                return await interaction.editReply({ embeds: [embed] });
                
            } catch (error) {
                console.error('Lyrics fetch error:', error);
                return await interaction.editReply({
                    content: config.messages.lyrics_error || '❌ Failed to fetch lyrics. Please try again later.'
                });
            }
        }

        // Query provided by user
        await interaction.deferReply();

        try {
            const { title, artist } = lyricsFetcher.parseSongInfo(query);
            const result = await lyricsFetcher.fetchLyrics(title, artist);
            
            if (!result.success) {
                return await interaction.editReply({
                    content: config.messages.lyrics_not_found || `❌ ${result.error || 'Lyrics not found for this song.'}`
                });
            }

            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.info)
                .setTitle(`🎵 ${result.title}`)
                .setDescription(config.messages.lyrics_found || 'Lyrics information found!')
                .addFields(
                    { name: '🎤 Artist', value: result.artist, inline: true },
                    { name: '🔗 View Lyrics', value: `[Click here](${result.url})`, inline: true }
                );

            if (result.releaseDate) {
                embed.addFields({ name: '📅 Release Date', value: result.releaseDate, inline: true });
            }

            if (result.thumbnail) {
                embed.setThumbnail(result.thumbnail);
            }

            embed.setFooter({ 
                text: config.messages.lyrics_footer || 'Data from Genius • Visit link to view full lyrics'
            });

            return await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Lyrics fetch error:', error);
            return await interaction.editReply({
                content: config.messages.lyrics_error || '❌ Failed to fetch lyrics. Please try again later.'
            });
        }
    },
};
