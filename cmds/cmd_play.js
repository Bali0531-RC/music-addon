const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getMusicPlayer, searchYouTube, config } = require('../music');
const { isBlacklisted, checkVoiceChannel } = require('../utils/musicUtils');
const { isSpotifyUrl } = require('../utils/spotifyUtils');
const { checkRateLimit } = require('../utils/rateLimitUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName(config.commands.play.name)
        .setDescription(config.commands.play.description)
        .addStringOption(option =>
            option.setName('query')
            .setDescription(config.commands.play.option_query)
            .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply();

        // Check rate limiting
        const rateLimitCheck = checkRateLimit(
            interaction.user.id, 
            'play',
            interaction.member.roles.cache.map(r => r.id)
        );
        if (!rateLimitCheck.allowed) {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.warning)
                .setDescription(rateLimitCheck.reason);
            return interaction.editReply({ embeds: [embed] });
        }

        const blacklistCheck = isBlacklisted(interaction.member);
        if (blacklistCheck.blacklisted) {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.error)
                .setDescription(blacklistCheck.reason);
            return interaction.editReply({ embeds: [embed] });
        }

        const voiceCheck = checkVoiceChannel(interaction, getMusicPlayer, true);
        if (!voiceCheck.allowed) {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.error)
                .setDescription(voiceCheck.reason);
            return interaction.editReply({ embeds: [embed] });
        }

        const query = interaction.options.getString('query');
        const isUrl = query.startsWith('http://') || query.startsWith('https://');

        // If it's a Spotify URL, handle it directly
        if (isSpotifyUrl(query)) {
            const player = getMusicPlayer(interaction, true);
            await player.play(query, 0, interaction.user.tag);
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.success)
                .setDescription(config.ui.processing_spotify);
            return interaction.editReply({ embeds: [embed] });
        }

        // If it's a YouTube URL, play directly
        if (isUrl) {
            const player = getMusicPlayer(interaction, true);
            await player.play(query, 0, interaction.user.tag);
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.success)
                .setDescription(config.ui.processing_song);
            return interaction.editReply({ embeds: [embed] });
        }

        // Otherwise, search YouTube
        const searchEmbed = new EmbedBuilder()
            .setColor(config.embed_colors.info)
            .setDescription(`${config.messages.searching} **${query}**`);
        await interaction.editReply({ embeds: [searchEmbed] });

        const searchResults = await searchYouTube(query);

        if (!searchResults || searchResults.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.error)
                .setDescription(config.messages.search_no_results);
            return interaction.editReply({ embeds: [embed] });
        }

        // Create embed with search results
        const resultsEmbed = new EmbedBuilder()
            .setColor(config.embed_colors.info)
            .setTitle(config.messages.search_results)
            .setDescription(config.messages.search_select)
            .addFields(
                searchResults.map(result => ({
                    name: `${result.number}. ${result.title}`,
                    value: `${config.ui.user_emoji} ${result.channel} | ${config.ui.time_emoji} ${formatDuration(result.duration)}`,
                    inline: false
                }))
            );

        // Create buttons for selection
        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('song_1').setLabel('1').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('song_2').setLabel('2').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('song_3').setLabel('3').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('song_4').setLabel('4').setStyle(ButtonStyle.Primary),
            );

        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('song_5').setLabel('5').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('song_6').setLabel('6').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('song_7').setLabel('7').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('song_cancel').setLabel(config.ui.button_cancel).setStyle(ButtonStyle.Danger),
            );

        const components = [row1];
        if (searchResults.length > 4) {
            components.push(row2);
        }

        await interaction.editReply({ embeds: [resultsEmbed], components });

        // Wait for button interaction
        const filter = i => i.user.id === interaction.user.id && i.customId.startsWith('song_');
        
        try {
            const buttonInteraction = await interaction.channel.awaitMessageComponent({ 
                filter, 
                time: config.search_timeout_seconds * 1000 
            });

            if (buttonInteraction.customId === 'song_cancel') {
                const embed = new EmbedBuilder()
                    .setColor(config.embed_colors.warning)
                    .setDescription(config.messages.search_cancelled);
                await buttonInteraction.update({ embeds: [embed], components: [] });
                return;
            }

            const selectedNumber = parseInt(buttonInteraction.customId.split('_')[1]);
            const selectedSong = searchResults[selectedNumber - 1];

            await buttonInteraction.deferUpdate();

            const player = getMusicPlayer(interaction, true);
            await player.play(selectedSong.url, 0, interaction.user.tag);

            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.success)
                .setDescription(`${config.ui.selected_song} **${selectedSong.title}**`);
            await interaction.editReply({ embeds: [embed], components: [] });

        } catch (error) {
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.error)
                .setDescription(config.messages.search_timeout);
            await interaction.editReply({ embeds: [embed], components: [] }).catch(() => {});
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