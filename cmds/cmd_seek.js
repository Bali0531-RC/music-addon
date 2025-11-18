const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getMusicPlayer, config } = require('../music');
const { isBlacklisted, checkVoiceChannel, isAdmin } = require('../utils/musicUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName(config.commands.seek.name)
        .setDescription(config.commands.seek.description)
        .addStringOption(option =>
            option.setName('time')
            .setDescription(config.commands.seek.option_time)
            .setRequired(true)),
    async execute(interaction) {
        // Check if feature is enabled
        if (!config.features.seek_enabled) {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.error)
                .setDescription('❌ Seek feature is currently disabled.');
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

        // Check if admin only
        if (config.seek.admin_only && !isAdmin(interaction.member)) {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.error)
                .setDescription('❌ Only admins can use the seek command.');
            return interaction.editReply({ embeds: [embed] });
        }

        const voiceCheck = checkVoiceChannel(interaction, getMusicPlayer, false);
        if (!voiceCheck.allowed) {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.error)
                .setDescription(voiceCheck.reason);
            return interaction.editReply({ embeds: [embed] });
        }

        const player = getMusicPlayer(interaction, false);
        if (!player || !player.getNowPlaying()) {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.error)
                .setDescription(config.messages.seek_not_playing);
            return interaction.editReply({ embeds: [embed] });
        }

        const timeInput = interaction.options.getString('time');
        let seconds;

        // Parse time input (supports "MM:SS" or just seconds)
        if (timeInput.includes(':')) {
            const parts = timeInput.split(':');
            if (parts.length === 2) {
                const minutes = parseInt(parts[0]);
                const secs = parseInt(parts[1]);
                if (isNaN(minutes) || isNaN(secs)) {
                    const embed = new EmbedBuilder()
                        .setColor(config.embed_colors.error)
                        .setDescription(config.messages.seek_invalid_time);
                    return interaction.editReply({ embeds: [embed] });
                }
                seconds = minutes * 60 + secs;
            } else if (parts.length === 3) {
                const hours = parseInt(parts[0]);
                const minutes = parseInt(parts[1]);
                const secs = parseInt(parts[2]);
                if (isNaN(hours) || isNaN(minutes) || isNaN(secs)) {
                    const embed = new EmbedBuilder()
                        .setColor(config.embed_colors.error)
                        .setDescription(config.messages.seek_invalid_time);
                    return interaction.editReply({ embeds: [embed] });
                }
                seconds = hours * 3600 + minutes * 60 + secs;
            } else {
                const embed = new EmbedBuilder()
                    .setColor(config.embed_colors.error)
                    .setDescription(config.messages.seek_invalid_time);
                return interaction.editReply({ embeds: [embed] });
            }
        } else {
            seconds = parseInt(timeInput);
            if (isNaN(seconds)) {
                const embed = new EmbedBuilder()
                    .setColor(config.embed_colors.error)
                    .setDescription(config.messages.seek_invalid_time);
                return interaction.editReply({ embeds: [embed] });
            }
        }

        const nowPlaying = player.getNowPlaying();
        if (seconds < 0 || seconds > nowPlaying.duration) {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.error)
                .setDescription(config.messages.seek_out_of_bounds);
            return interaction.editReply({ embeds: [embed] });
        }

        // Seek by replaying from the position
        // Note: Discord.js doesn't support native seeking, so we restart from the seek position using FFmpeg
        try {
            const path = require('path');
            const fs = require('fs');
            const { createAudioResource } = require('@discordjs/voice');
            
            const tmpDir = path.join(__dirname, '..', config.tmp_folder);
            const filePath = path.join(tmpDir, `${nowPlaying.id}.mp3`);
            
            if (!fs.existsSync(filePath)) {
                const embed = new EmbedBuilder()
                    .setColor(config.embed_colors.error)
                    .setDescription('❌ Audio file not found. Try playing the song again.');
                return interaction.editReply({ embeds: [embed] });
            }

            // Create audio resource with seek offset using FFmpeg
            const resource = createAudioResource(filePath, {
                inlineVolume: true,
                inputType: require('@discordjs/voice').StreamType.Arbitrary,
                metadata: {
                    seek: seconds
                }
            });

            player.player.play(resource);

            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.success)
                .setDescription(`${config.messages.seek_success} **${player.formatDuration(seconds)}**`);
            interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Seek error:', error);
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.error)
                .setDescription('❌ Failed to seek. This feature may not be fully supported.');
            interaction.editReply({ embeds: [embed] });
        }
    },
};
