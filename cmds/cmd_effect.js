const { SlashCommandBuilder } = require('discord.js');
const { EmbedBuilder } = require('discord.js');
const { getMusicPlayer, config, audioEffects } = require('../music.js');
const { checkBlacklist } = require('../utils/blacklistUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName(config.commands.effect.name)
        .setDescription(config.commands.effect.description)
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Apply an audio effect')
                .addStringOption(option =>
                    option
                        .setName('effect')
                        .setDescription('The effect to apply')
                        .setRequired(true)
                        .addChoices(
                            ...getEffectChoices()
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove current audio effect')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all available audio effects')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('current')
                .setDescription('Show your current audio effect')
        ),

    async execute(interaction) {
        // Feature flag check
        if (!config.features.audio_effects_enabled) {
            return await interaction.reply({
                content: config.messages.feature_disabled || '❌ This feature is currently disabled.',
                ephemeral: true
            });
        }

        // Blacklist check
        if (!(await checkBlacklist(interaction))) {
            return;
        }

        if (!audioEffects) {
            return await interaction.reply({
                content: '❌ Audio effects system is not initialized.',
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        // Handle subcommands
        if (subcommand === 'list') {
            const effects = audioEffects.getAvailableEffects();
            
            if (effects.length === 0) {
                return await interaction.reply({
                    content: config.messages.effects_none_available || '❌ No audio effects are currently available.',
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.info)
                .setTitle(config.messages.effects_list_title || '🎵 Available Audio Effects')
                .setDescription(effects.map(e => 
                    `**${e.name}** (\`${e.id}\`)\n${e.description}`
                ).join('\n\n'))
                .setFooter({ text: config.messages.effects_usage || 'Use /effect set <effect> to apply an effect' });

            return await interaction.reply({ embeds: [embed] });
        }

        if (subcommand === 'current') {
            const currentEffect = audioEffects.getUserEffect(userId);
            
            if (!currentEffect) {
                return await interaction.reply({
                    content: config.messages.effects_none_active || '🎵 You have no audio effect currently active.',
                    ephemeral: true
                });
            }

            const effect = audioEffects.getEffect(currentEffect);
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.info)
                .setTitle(config.messages.effects_current_title || '🎵 Current Audio Effect')
                .setDescription(`**${effect.name}** (\`${effect.id}\`)\n${effect.description}`);

            return await interaction.reply({ embeds: [embed] });
        }

        if (subcommand === 'set') {
            const effectId = interaction.options.getString('effect');
            
            if (!audioEffects.isEffectAvailable(effectId)) {
                return await interaction.reply({
                    content: config.messages.effects_invalid || '❌ Invalid or unavailable audio effect.',
                    ephemeral: true
                });
            }

            const success = audioEffects.setUserEffect(userId, effectId);
            
            if (!success) {
                return await interaction.reply({
                    content: config.messages.effects_set_error || '❌ Failed to set audio effect.',
                    ephemeral: true
                });
            }

            const effect = audioEffects.getEffect(effectId);
            
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.success)
                .setTitle(config.messages.effects_set_title || '✅ Audio Effect Applied')
                .setDescription((config.messages.effects_set_description || 'Applied **{name}** effect. This will be applied to all songs you play.')
                    .replace('{name}', effect.name))
                .addFields({ 
                    name: 'Description', 
                    value: effect.description 
                })
                .setFooter({ text: config.messages.effects_next_song || 'Effect will apply to the next song played' });

            return await interaction.reply({ embeds: [embed] });
        }

        if (subcommand === 'remove') {
            const currentEffect = audioEffects.getUserEffect(userId);
            
            if (!currentEffect) {
                return await interaction.reply({
                    content: config.messages.effects_none_to_remove || '🎵 You have no audio effect to remove.',
                    ephemeral: true
                });
            }

            audioEffects.setUserEffect(userId, null);
            
            const embed = new EmbedBuilder()
                .setColor(config.embed_colors.success)
                .setTitle(config.messages.effects_removed_title || '✅ Audio Effect Removed')
                .setDescription(config.messages.effects_removed_description || 'Audio effect has been removed. Songs will play with normal audio.');

            return await interaction.reply({ embeds: [embed] });
        }
    },
};

function getEffectChoices() {
    if (!config.features.audio_effects_enabled || !audioEffects) {
        return [{ name: 'No effects available', value: 'none' }];
    }

    const effects = audioEffects.getAvailableEffects();
    if (effects.length === 0) {
        return [{ name: 'No effects available', value: 'none' }];
    }

    return effects.map(e => ({ 
        name: `${e.name} - ${e.description}`, 
        value: e.id 
    })).slice(0, 25); // Discord limit
}
