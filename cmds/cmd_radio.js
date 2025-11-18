const { SlashCommandBuilder } = require('discord.js');
const { EmbedBuilder } = require('discord.js');
const { getMusicPlayer, config, radioMode } = require('../music.js');
const { checkBlacklist } = require('../utils/blacklistUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName(config.commands.radio.name)
        .setDescription(config.commands.radio.description)
        .addSubcommand(subcommand =>
            subcommand
                .setName('start')
                .setDescription('Start radio mode with current or specified song')
                .addStringOption(option =>
                    option
                        .setName('query')
                        .setDescription('Song to base radio on (leave empty for current song)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('stop')
                .setDescription('Stop radio mode')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Check radio mode status')
        ),

    async execute(interaction) {
        // Feature flag check
        if (!config.features.radio_enabled) {
            return await interaction.reply({
                content: config.messages.feature_disabled || '❌ This feature is currently disabled.',
                ephemeral: true
            });
        }

        // Blacklist check
        if (!(await checkBlacklist(interaction))) {
            return;
        }

        if (!radioMode) {
            return await interaction.reply({
                content: '❌ Radio mode is not initialized.',
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();
        const player = getMusicPlayer(interaction.guildId);

        // Handle status command
        if (subcommand === 'status') {
            const isActive = radioMode.isActive(interaction.guildId);
            
            if (!isActive) {
                return await interaction.reply({
                    content: config.messages.radio_not_active || '📻 Radio mode is not active.',
                    ephemeral: true
                });
            }

            const stats = radioMode.getStats(interaction.guildId);
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.info)
                .setTitle(config.messages.radio_status_title || '📻 Radio Mode Status')
                .addFields(
                    { name: 'Status', value: '🟢 Active', inline: true },
                    { name: 'Songs Added', value: stats.songsAdded.toString(), inline: true }
                )
                .setFooter({ text: config.messages.radio_status_footer || 'Radio will automatically add related songs to queue' });

            return await interaction.reply({ embeds: [embed] });
        }

        // Handle stop command
        if (subcommand === 'stop') {
            const isActive = radioMode.isActive(interaction.guildId);
            
            if (!isActive) {
                return await interaction.reply({
                    content: config.messages.radio_not_active || '📻 Radio mode is not active.',
                    ephemeral: true
                });
            }

            radioMode.stop(interaction.guildId);

            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.success)
                .setTitle(config.messages.radio_stopped_title || '📻 Radio Mode Stopped')
                .setDescription(config.messages.radio_stopped_description || 'Radio mode has been disabled. The queue will no longer auto-refill.');

            return await interaction.reply({ embeds: [embed] });
        }

        // Handle start command
        if (subcommand === 'start') {
            const query = interaction.options.getString('query');

            // If radio is already active, notify user
            if (radioMode.isActive(interaction.guildId)) {
                return await interaction.reply({
                    content: config.messages.radio_already_active || '📻 Radio mode is already active. Use `/radio stop` to disable it first.',
                    ephemeral: true
                });
            }

            // If query provided, start playing that song first
            if (query) {
                if (!player) {
                    // Need to be in voice channel
                    if (!interaction.member.voice.channel) {
                        return await interaction.reply({
                            content: config.messages.no_voice_channel || 'You need to be in a voice channel!',
                            ephemeral: true
                        });
                    }

                    // Create player and play the seed song
                    const newPlayer = getMusicPlayer(interaction.guildId, interaction);
                    await interaction.deferReply();
                    
                    await newPlayer.play(query, 0, interaction.user.tag, interaction.user.id);
                    
                    // Get the video ID from the now playing or queue
                    const seedSong = newPlayer.nowPlaying || newPlayer.queue[0];
                    if (seedSong) {
                        radioMode.start(interaction.guildId, seedSong.id);
                        
                        const embed = new EmbedBuilder()
                            .setColor(config.embed_colors.success)
                            .setTitle(config.messages.radio_started_title || '📻 Radio Mode Started')
                            .setDescription((config.messages.radio_started_description || 'Radio mode activated! Similar songs will be automatically added to the queue.')
                                + `\n\n**Based on:** ${seedSong.title}`);
                        
                        return await interaction.editReply({ embeds: [embed] });
                    } else {
                        return await interaction.editReply({
                            content: config.messages.radio_start_error || '❌ Failed to start radio mode.'
                        });
                    }
                } else {
                    // Add song to existing player's queue
                    await interaction.deferReply();
                    await player.play(query, 0, interaction.user.tag, interaction.user.id);
                    
                    const addedSong = player.queue[player.queue.length - 1];
                    if (addedSong) {
                        radioMode.start(interaction.guildId, addedSong.id);
                        
                        const embed = new EmbedBuilder()
                            .setColor(config.embed_colors.success)
                            .setTitle(config.messages.radio_started_title || '📻 Radio Mode Started')
                            .setDescription((config.messages.radio_started_description || 'Radio mode activated! Similar songs will be automatically added to the queue.')
                                + `\n\n**Based on:** ${addedSong.title}`);
                        
                        return await interaction.editReply({ embeds: [embed] });
                    } else {
                        return await interaction.editReply({
                            content: config.messages.radio_start_error || '❌ Failed to start radio mode.'
                        });
                    }
                }
            }

            // No query - use current playing song
            if (!player) {
                return await interaction.reply({
                    content: config.messages.no_player || '❌ No music is playing. Provide a song to start radio mode.',
                    ephemeral: true
                });
            }

            const nowPlaying = player.getNowPlaying();
            
            if (!nowPlaying) {
                return await interaction.reply({
                    content: config.messages.no_song_playing || '❌ No song is currently playing. Provide a song to start radio mode.',
                    ephemeral: true
                });
            }

            // Start radio mode with current song
            radioMode.start(interaction.guildId, nowPlaying.id);

            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.success)
                .setTitle(config.messages.radio_started_title || '📻 Radio Mode Started')
                .setDescription((config.messages.radio_started_description || 'Radio mode activated! Similar songs will be automatically added to the queue.')
                    + `\n\n**Based on:** ${nowPlaying.title}`)
                .setFooter({ text: config.messages.radio_footer || 'Queue will auto-refill when running low' });

            return await interaction.reply({ embeds: [embed] });
        }
    },
};
