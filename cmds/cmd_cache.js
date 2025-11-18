const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { EmbedBuilder } = require('discord.js');
const { getMusicPlayer, config, cacheManager, statisticsManager } = require('../music.js');
const { checkBlacklist } = require('../utils/blacklistUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName(config.commands.cache.name)
        .setDescription(config.commands.cache.description)
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('View cache statistics')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('clean')
                .setDescription('Clean old and unpopular cached files')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('clear')
                .setDescription('Clear entire cache (admin only)')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        // Feature flag check
        if (!config.features.smart_cache_enabled) {
            return await interaction.reply({
                content: config.messages.feature_disabled || '❌ This feature is currently disabled.',
                ephemeral: true
            });
        }

        // Blacklist check
        if (!(await checkBlacklist(interaction))) {
            return;
        }

        if (!cacheManager) {
            return await interaction.reply({
                content: '❌ Cache manager is not initialized.',
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();

        // STATS - Show cache statistics
        if (subcommand === 'stats') {
            const stats = cacheManager.getStats();
            const playCountMap = statisticsManager 
                ? statisticsManager.getAllPlayCounts(interaction.guildId)
                : {};
            
            const cachedFiles = cacheManager.getCachedFiles(playCountMap);
            const popularFiles = cachedFiles.filter(f => f.isPopular);

            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.info)
                .setTitle(config.messages.cache_stats_title || '📊 Cache Statistics')
                .addFields(
                    { name: '📁 Total Files', value: stats.totalFiles.toString(), inline: true },
                    { name: '💾 Total Size', value: `${stats.totalSizeMB} MB`, inline: true },
                    { name: '⭐ Popular Files', value: popularFiles.length.toString(), inline: true },
                    { name: '✅ Cache Hits', value: stats.hits.toString(), inline: true },
                    { name: '❌ Cache Misses', value: stats.misses.toString(), inline: true },
                    { name: '📈 Hit Rate', value: `${stats.hitRate}%`, inline: true }
                )
                .setFooter({ 
                    text: config.messages.cache_stats_footer || `Popular threshold: ${cacheManager.popularThreshold} plays • Max size: ${cacheManager.maxSizeMB} MB` 
                });

            // Add top 5 most popular cached files
            if (popularFiles.length > 0) {
                const top5 = popularFiles.slice(0, 5);
                const topList = top5.map((f, i) => 
                    `${i + 1}. ${f.videoId} (${f.playCount} plays, ${f.sizeMB} MB)`
                ).join('\n');
                embed.addFields({ name: '🔥 Top Cached Files', value: topList });
            }

            return await interaction.reply({ embeds: [embed] });
        }

        // CLEAN - Clean cache based on rules
        if (subcommand === 'clean') {
            await interaction.deferReply();

            const player = getMusicPlayer(interaction.guildId);
            const playCountMap = player ? player.getAllPlayCounts() : {};

            const result = cacheManager.cleanCache(playCountMap);

            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.success)
                .setTitle(config.messages.cache_clean_title || '🧹 Cache Cleaned')
                .setDescription(
                    (config.messages.cache_clean_description || 'Cleaned cache based on popularity and age.')
                    + `\n\n**Files deleted:** ${result.deleted}\n**Popular files kept:** ${result.keptPopular}`
                );

            const stats = cacheManager.getStats();
            embed.addFields(
                { name: '📁 Files Remaining', value: stats.totalFiles.toString(), inline: true },
                { name: '💾 Cache Size', value: `${stats.totalSizeMB} MB`, inline: true }
            );

            return await interaction.editReply({ embeds: [embed] });
        }

        // CLEAR - Clear entire cache (admin only)
        if (subcommand === 'clear') {
            // Additional admin check
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await interaction.reply({
                    content: config.messages.admin_only || '❌ This command requires Administrator permission.',
                    ephemeral: true
                });
            }

            await interaction.deferReply();

            const deletedCount = cacheManager.clearAll();

            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.success)
                .setTitle(config.messages.cache_cleared_title || '🗑️ Cache Cleared')
                .setDescription(
                    (config.messages.cache_cleared_description || 'All cached files have been removed.')
                    + `\n\n**Files deleted:** ${deletedCount}`
                )
                .setFooter({ text: config.messages.cache_cleared_footer || 'Cache statistics have been reset' });

            return await interaction.editReply({ embeds: [embed] });
        }
    },
};
