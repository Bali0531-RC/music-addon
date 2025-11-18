const { EmbedBuilder } = require('discord.js');
const { isBlacklisted } = require('./musicUtils');
const { config } = require('../music');

/**
 * Check if user is blacklisted and send error message if so
 * @param {CommandInteraction} interaction - Discord interaction
 * @returns {Promise<boolean>} - True if allowed, false if blacklisted
 */
async function checkBlacklist(interaction) {
    const blacklistCheck = isBlacklisted(interaction.member);
    
    if (blacklistCheck.blacklisted) {
        const embed = new EmbedBuilder()
            .setColor(config.embed_colors.error)
            .setDescription(blacklistCheck.reason);
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return false;
    }
    
    return true;
}

module.exports = { checkBlacklist };
