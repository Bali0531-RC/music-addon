const fs = require('fs');
const path = require('path');

/**
 * Clean up all files in a directory
 * @param {string} dirPath - Path to the directory to clean
 * @returns {number} - Number of files deleted
 */
function cleanupDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
        const config = require('../music').config;
        console.log(config.console.directory_not_exist.replace('{path}', dirPath));
        return 0;
    }

    try {
        const files = fs.readdirSync(dirPath);
        let deletedCount = 0;

        for (const file of files) {
            const filePath = path.join(dirPath, file);
            try {
                const stats = fs.statSync(filePath);
                if (stats.isFile()) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                }
            } catch (err) {
                console.error(`Failed to delete ${filePath}:`, err.message);
            }
        }

        return deletedCount;
    } catch (err) {
        console.error(`Error reading directory ${dirPath}:`, err.message);
        return 0;
    }
}

/**
 * Clean up old files in a directory based on age
 * @param {string} dirPath - Path to the directory to clean
 * @param {number} maxAgeMinutes - Maximum age in minutes
 * @returns {number} - Number of files deleted
 */
function cleanupOldFiles(dirPath, maxAgeMinutes) {
    if (!fs.existsSync(dirPath)) {
        return 0;
    }

    try {
        const files = fs.readdirSync(dirPath);
        let deletedCount = 0;
        const now = Date.now();
        const maxAge = maxAgeMinutes * 60 * 1000;

        for (const file of files) {
            const filePath = path.join(dirPath, file);
            try {
                const stats = fs.statSync(filePath);
                if (stats.isFile()) {
                    const fileAge = now - stats.mtimeMs;
                    if (fileAge > maxAge) {
                        fs.unlinkSync(filePath);
                        deletedCount++;
                    }
                }
            } catch (err) {
                console.error(`Failed to process ${filePath}:`, err.message);
            }
        }

        return deletedCount;
    } catch (err) {
        console.error(`Error cleaning old files in ${dirPath}:`, err.message);
        return 0;
    }
}

/**
 * Get directory size in MB
 * @param {string} dirPath - Path to the directory
 * @returns {number} - Size in MB
 */
function getDirectorySize(dirPath) {
    if (!fs.existsSync(dirPath)) {
        return 0;
    }

    try {
        const files = fs.readdirSync(dirPath);
        let totalSize = 0;

        for (const file of files) {
            const filePath = path.join(dirPath, file);
            try {
                const stats = fs.statSync(filePath);
                if (stats.isFile()) {
                    totalSize += stats.size;
                }
            } catch (err) {
                // Skip files that can't be read
            }
        }

        return (totalSize / (1024 * 1024)).toFixed(2);
    } catch (err) {
        console.error(`Error calculating directory size for ${dirPath}:`, err.message);
        return 0;
    }
}

module.exports = {
    cleanupDirectory,
    cleanupOldFiles,
    getDirectorySize
};
