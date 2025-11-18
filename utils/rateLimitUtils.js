const { config } = require('../music');

// Track command usage: userId -> { commandName -> timestamps[] }
const commandUsage = new Map();

/**
 * Check if a user has exceeded rate limits
 * @param {string} userId - Discord user ID
 * @param {string} commandName - Command being executed
 * @param {Array} exemptRoles - User's role IDs
 * @returns {Object} - { allowed: boolean, reason: string }
 */
function checkRateLimit(userId, commandName, exemptRoles = []) {
    if (!config.features.rate_limiting_enabled) {
        return { allowed: true };
    }

    // Check if user has exempt role
    const hasExemptRole = exemptRoles.some(roleId => 
        config.rate_limiting.exempt_roles.includes(roleId)
    );
    
    if (hasExemptRole) {
        return { allowed: true };
    }

    const now = Date.now();
    const oneMinuteAgo = now - 60000; // 60 seconds

    // Initialize user tracking if not exists
    if (!commandUsage.has(userId)) {
        commandUsage.set(userId, new Map());
    }

    const userCommands = commandUsage.get(userId);

    // Clean up old timestamps
    for (const [cmd, timestamps] of userCommands.entries()) {
        userCommands.set(cmd, timestamps.filter(ts => ts > oneMinuteAgo));
    }

    // Get timestamps for all commands
    let totalCommands = 0;
    for (const timestamps of userCommands.values()) {
        totalCommands += timestamps.length;
    }

    // Check global command limit
    if (totalCommands >= config.rate_limiting.commands_per_minute) {
        return {
            allowed: false,
            reason: config.messages.rate_limit_exceeded
        };
    }

    // Check play command specific limit
    if (commandName === 'play') {
        const playTimestamps = userCommands.get('play') || [];
        if (playTimestamps.length >= config.rate_limiting.play_per_minute) {
            return {
                allowed: false,
                reason: config.messages.rate_limit_exceeded
            };
        }
    }

    // Record this command usage
    if (!userCommands.has(commandName)) {
        userCommands.set(commandName, []);
    }
    userCommands.get(commandName).push(now);

    return { allowed: true };
}

/**
 * Reset rate limits for a user (admin function)
 * @param {string} userId - Discord user ID
 */
function resetUserRateLimit(userId) {
    commandUsage.delete(userId);
}

/**
 * Clear all rate limit data (for cleanup)
 */
function clearAllRateLimits() {
    commandUsage.clear();
}

/**
 * Get rate limit stats for a user
 * @param {string} userId - Discord user ID
 * @returns {Object} - { commandCounts: Object, total: number }
 */
function getUserRateLimitStats(userId) {
    if (!commandUsage.has(userId)) {
        return { commandCounts: {}, total: 0 };
    }

    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const userCommands = commandUsage.get(userId);
    const commandCounts = {};
    let total = 0;

    for (const [cmd, timestamps] of userCommands.entries()) {
        const recentCount = timestamps.filter(ts => ts > oneMinuteAgo).length;
        if (recentCount > 0) {
            commandCounts[cmd] = recentCount;
            total += recentCount;
        }
    }

    return { commandCounts, total };
}

// Periodic cleanup of old data (run every 5 minutes)
setInterval(() => {
    const fiveMinutesAgo = Date.now() - 300000;
    
    for (const [userId, userCommands] of commandUsage.entries()) {
        // Remove old timestamps
        for (const [cmd, timestamps] of userCommands.entries()) {
            const filtered = timestamps.filter(ts => ts > fiveMinutesAgo);
            if (filtered.length === 0) {
                userCommands.delete(cmd);
            } else {
                userCommands.set(cmd, filtered);
            }
        }
        
        // Remove user if no commands left
        if (userCommands.size === 0) {
            commandUsage.delete(userId);
        }
    }
}, 300000); // 5 minutes

module.exports = {
    checkRateLimit,
    resetUserRateLimit,
    clearAllRateLimits,
    getUserRateLimitStats
};
