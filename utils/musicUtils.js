const fs = require('fs');
const path = require('path');
const yaml = require("js-yaml");

// Product licensing metadata
const PRODUCT_LICENSE_TYPE = '%%__PRODUCT__%%';

function isBlacklisted(member) {
    const config = yaml.load(fs.readFileSync(path.join(__dirname, '../config.yml'), 'utf8'));
    
    // Check if music bot is disabled
    if (!config.MusicBot || !config.MusicBot.Enabled) {
        return { blacklisted: true, reason: '❌ Music bot is currently disabled.' };
    }

    // Check if user is blacklisted
    if (config.MusicBot.BlacklistedUsers && config.MusicBot.BlacklistedUsers.includes(member.id)) {
        return { blacklisted: true, reason: '❌ You are blacklisted from using music commands.' };
    }

    // Check if user has a blacklisted role
    if (config.MusicBot.BlacklistedRoles && config.MusicBot.BlacklistedRoles.length > 0) {
        const hasBlacklistedRole = member.roles.cache.some(role => 
            config.MusicBot.BlacklistedRoles.includes(role.id)
        );
        if (hasBlacklistedRole) {
            return { blacklisted: true, reason: '❌ Your role is blacklisted from using music commands.' };
        }
    }

    // Check whitelist if enabled
    if (config.MusicBot.WhitelistEnabled) {
        const whitelistedUsers = config.MusicBot.WhitelistedUsers || [];
        const whitelistedRoles = config.MusicBot.WhitelistedRoles || [];

        // Check if user is whitelisted
        const isUserWhitelisted = whitelistedUsers.includes(member.id);
        
        // Check if user has a whitelisted role
        const hasWhitelistedRole = whitelistedRoles.length > 0 && 
            member.roles.cache.some(role => whitelistedRoles.includes(role.id));

        // If whitelist is enabled and user is neither whitelisted nor has whitelisted role
        if (!isUserWhitelisted && !hasWhitelistedRole) {
            if (whitelistedRoles.length > 0 && whitelistedUsers.length > 0) {
                return { blacklisted: true, reason: '❌ You need to be whitelisted or have a whitelisted role to use music commands.' };
            } else if (whitelistedRoles.length > 0) {
                return { blacklisted: true, reason: '❌ Your role is not whitelisted to use music commands.' };
            } else {
                return { blacklisted: true, reason: '❌ You are not whitelisted to use music commands.' };
            }
        }
    }

    return { blacklisted: false };
}

function isAdmin(member) {
    const config = yaml.load(fs.readFileSync(path.join(__dirname, '../config.yml'), 'utf8'));
    
    // Check if user has any admin roles
    if (config.MusicBot.AdminRoles && config.MusicBot.AdminRoles.length > 0) {
        return member.roles.cache.some(role => 
            config.MusicBot.AdminRoles.includes(role.id)
        );
    }
    
    return false;
}

function checkVoiceChannel(interaction, getMusicPlayer, isPlayCommand = false) {
    const config = yaml.load(fs.readFileSync(path.join(__dirname, '../config.yml'), 'utf8'));
    
    // Check if user is an admin
    const userIsAdmin = isAdmin(interaction.member);
    
    // Check if user is in a voice channel
    if (!interaction.member.voice.channel) {
        // Admins can control bot even if not in a voice channel
        if (userIsAdmin) {
            // For play command, bot must already be in a voice channel
            if (isPlayCommand) {
                const player = getMusicPlayer(interaction);
                if (!player || !player.voiceChannel) {
                    return { 
                        allowed: false, 
                        reason: config.messages.no_voice_channel 
                    };
                }
            }
            // Admin can use other commands without being in a voice channel
            return { allowed: true };
        }
        
        return { 
            allowed: false, 
            reason: config.messages.no_voice_channel 
        };
    }

    // Get the music player for this guild
    const player = getMusicPlayer(interaction);
    
    // If bot is playing music, check if user is in the same voice channel
    if (player && player.voiceChannel) {
        if (interaction.member.voice.channel.id !== player.voiceChannel.id) {
            // Admins can bypass same-channel restriction
            if (userIsAdmin) {
                return { allowed: true };
            }
            
            return { 
                allowed: false, 
                reason: config.messages.not_in_same_channel 
            };
        }
    }

    return { allowed: true };
}

module.exports = { isBlacklisted, checkVoiceChannel };
