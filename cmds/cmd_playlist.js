const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getMusicPlayer, config, favoritesManager } = require('../music');
const { isBlacklisted, checkVoiceChannel } = require('../utils/musicUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName(config.commands.playlist.name)
        .setDescription(config.commands.playlist.description)
        .addStringOption(option =>
            option.setName('action')
            .setDescription(config.commands.playlist.option_action)
            .setRequired(true)
            .addChoices(
                { name: 'Create', value: 'create' },
                { name: 'Delete', value: 'delete' },
                { name: 'Add Current Song', value: 'add' },
                { name: 'Remove Song', value: 'remove' },
                { name: 'Show', value: 'show' },
                { name: 'Play', value: 'play' },
                { name: 'List All', value: 'list' },
                { name: 'Rename', value: 'rename' }
            ))
        .addStringOption(option =>
            option.setName('playlist')
            .setDescription(config.commands.playlist.option_playlist)
            .setRequired(false))
        .addIntegerOption(option =>
            option.setName('song_number')
            .setDescription('Song number to remove (from /playlist show)')
            .setRequired(false)
            .setMinValue(1))
        .addStringOption(option =>
            option.setName('new_name')
            .setDescription(config.commands.playlist.option_new_name)
            .setRequired(false)),
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

        const action = interaction.options.getString('action');
        const playlistName = interaction.options.getString('playlist');
        const songNumber = interaction.options.getInteger('song_number');
        const newName = interaction.options.getString('new_name');

        // List all playlists
        if (action === 'list') {
            const playlists = favoritesManager.getPlaylists(interaction.user.id);
            
            if (playlists.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(config.embed_colors.info)
                    .setDescription(config.messages.playlists_empty);
                return interaction.editReply({ embeds: [embed] });
            }

            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.info)
                .setTitle(`📚 Your Playlists (${playlists.length}/${config.favorites.max_playlists_per_user})`)
                .setDescription(
                    playlists.map((pl, index) => {
                        return `**${index + 1}.** ${pl.name} - ${pl.songs.length} songs`;
                    }).join('\n')
                );
            return interaction.editReply({ embeds: [embed] });
        }

        // Actions that require playlist name
        if (!playlistName && action !== 'list') {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.error)
                .setDescription('❌ Please provide a playlist name.');
            return interaction.editReply({ embeds: [embed] });
        }

        switch (action) {
            case 'create':
                {
                    const result = favoritesManager.createPlaylist(interaction.user.id, playlistName);
                    if (result.success) {
                        const embed = new EmbedBuilder()
                            .setColor(config.embed_colors.success)
                            .setDescription(config.messages.playlist_created.replace('{name}', playlistName));
                        interaction.editReply({ embeds: [embed] });
                    } else {
                        const embed = new EmbedBuilder()
                            .setColor(config.embed_colors.error)
                            .setDescription(result.reason);
                        interaction.editReply({ embeds: [embed] });
                    }
                }
                break;

            case 'delete':
                {
                    const result = favoritesManager.deletePlaylist(interaction.user.id, playlistName);
                    if (result.success) {
                        const embed = new EmbedBuilder()
                            .setColor(config.embed_colors.success)
                            .setDescription(config.messages.playlist_deleted.replace('{name}', playlistName));
                        interaction.editReply({ embeds: [embed] });
                    } else {
                        const embed = new EmbedBuilder()
                            .setColor(config.embed_colors.error)
                            .setDescription(config.messages.playlist_not_found);
                        interaction.editReply({ embeds: [embed] });
                    }
                }
                break;

            case 'add':
                {
                    const player = getMusicPlayer(interaction, false);
                    if (!player || !player.getNowPlaying()) {
                        const embed = new EmbedBuilder()
                            .setColor(config.embed_colors.error)
                            .setDescription('❌ No song currently playing.');
                        return interaction.editReply({ embeds: [embed] });
                    }

                    const nowPlaying = player.getNowPlaying();
                    const result = favoritesManager.addToPlaylist(interaction.user.id, playlistName, nowPlaying);
                    
                    if (result.success) {
                        const embed = new EmbedBuilder()
                            .setColor(config.embed_colors.success)
                            .setDescription(config.messages.playlist_song_added.replace('{name}', playlistName))
                            .addFields({ name: 'Song', value: `[${nowPlaying.title}](${nowPlaying.url})` });
                        interaction.editReply({ embeds: [embed] });
                    } else {
                        const embed = new EmbedBuilder()
                            .setColor(config.embed_colors.error)
                            .setDescription(result.reason);
                        interaction.editReply({ embeds: [embed] });
                    }
                }
                break;

            case 'remove':
                {
                    if (!songNumber) {
                        const embed = new EmbedBuilder()
                            .setColor(config.embed_colors.error)
                            .setDescription('❌ Please provide a song number to remove.');
                        return interaction.editReply({ embeds: [embed] });
                    }

                    const playlist = favoritesManager.getPlaylist(interaction.user.id, playlistName);
                    if (!playlist) {
                        const embed = new EmbedBuilder()
                            .setColor(config.embed_colors.error)
                            .setDescription(config.messages.playlist_not_found);
                        return interaction.editReply({ embeds: [embed] });
                    }

                    if (songNumber > playlist.songs.length) {
                        const embed = new EmbedBuilder()
                            .setColor(config.embed_colors.error)
                            .setDescription('❌ Invalid song number.');
                        return interaction.editReply({ embeds: [embed] });
                    }

                    const song = playlist.songs[songNumber - 1];
                    const result = favoritesManager.removeFromPlaylist(interaction.user.id, playlistName, song.id);
                    
                    if (result.success) {
                        const embed = new EmbedBuilder()
                            .setColor(config.embed_colors.success)
                            .setDescription(config.messages.playlist_song_removed.replace('{name}', playlistName));
                        interaction.editReply({ embeds: [embed] });
                    } else {
                        const embed = new EmbedBuilder()
                            .setColor(config.embed_colors.error)
                            .setDescription(result.reason);
                        interaction.editReply({ embeds: [embed] });
                    }
                }
                break;

            case 'show':
                {
                    const playlist = favoritesManager.getPlaylist(interaction.user.id, playlistName);
                    if (!playlist) {
                        const embed = new EmbedBuilder()
                            .setColor(config.embed_colors.error)
                            .setDescription(config.messages.playlist_not_found);
                        return interaction.editReply({ embeds: [embed] });
                    }

                    if (playlist.songs.length === 0) {
                        const embed = new EmbedBuilder()
                            .setColor(config.embed_colors.info)
                            .setTitle(`📚 ${playlistName}`)
                            .setDescription('This playlist is empty.');
                        return interaction.editReply({ embeds: [embed] });
                    }

                    const embed = new EmbedBuilder()
                        .setColor(config.embed_colors.info)
                        .setTitle(`📚 ${playlistName} (${playlist.songs.length} songs)`)
                        .setDescription(
                            playlist.songs.slice(0, 25).map((song, index) => {
                                return `**${index + 1}.** [${song.title}](${song.url})`;
                            }).join('\n')
                        );

                    if (playlist.songs.length > 25) {
                        embed.setFooter({ text: `Showing 25 of ${playlist.songs.length} songs` });
                    }

                    interaction.editReply({ embeds: [embed] });
                }
                break;

            case 'play':
                {
                    const voiceCheck = checkVoiceChannel(interaction, getMusicPlayer, true);
                    if (!voiceCheck.allowed) {
                        const embed = new EmbedBuilder()
                            .setColor(config.embed_colors.error)
                            .setDescription(voiceCheck.reason);
                        return interaction.editReply({ embeds: [embed] });
                    }

                    const playlist = favoritesManager.getPlaylist(interaction.user.id, playlistName);
                    if (!playlist) {
                        const embed = new EmbedBuilder()
                            .setColor(config.embed_colors.error)
                            .setDescription(config.messages.playlist_not_found);
                        return interaction.editReply({ embeds: [embed] });
                    }

                    if (playlist.songs.length === 0) {
                        const embed = new EmbedBuilder()
                            .setColor(config.embed_colors.error)
                            .setDescription('❌ Playlist is empty.');
                        return interaction.editReply({ embeds: [embed] });
                    }

                    const player = getMusicPlayer(interaction, true);
                    
                    // Add all songs from playlist to queue
                    for (const song of playlist.songs) {
                        await player.play(song.url, 0, interaction.user.tag, interaction.user.id);
                    }

                    const embed = new EmbedBuilder()
                        .setColor(config.embed_colors.success)
                        .setDescription(`✅ Added ${playlist.songs.length} songs from **${playlistName}** to queue!`);
                    interaction.editReply({ embeds: [embed] });
                }
                break;

            case 'rename':
                {
                    if (!newName) {
                        const embed = new EmbedBuilder()
                            .setColor(config.embed_colors.error)
                            .setDescription('❌ Please provide a new name.');
                        return interaction.editReply({ embeds: [embed] });
                    }

                    const result = favoritesManager.renamePlaylist(interaction.user.id, playlistName, newName);
                    if (result.success) {
                        const embed = new EmbedBuilder()
                            .setColor(config.embed_colors.success)
                            .setDescription(`✅ Renamed **${playlistName}** to **${newName}**!`);
                        interaction.editReply({ embeds: [embed] });
                    } else {
                        const embed = new EmbedBuilder()
                            .setColor(config.embed_colors.error)
                            .setDescription(result.reason);
                        interaction.editReply({ embeds: [embed] });
                    }
                }
                break;

            default:
                const embed = new EmbedBuilder()
                    .setColor(config.embed_colors.error)
                    .setDescription('❌ Invalid action.');
                interaction.editReply({ embeds: [embed] });
        }
    },
};
