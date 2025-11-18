const fs = require('fs');
const path = require('path');

/**
 * Favorites and Playlists Manager
 * Allows users to save favorite songs and create custom playlists
 */

class FavoritesManager {
    constructor(dataFile, maxPlaylists = 10, maxSongsPerPlaylist = 100) {
        this.dataFile = dataFile;
        this.maxPlaylists = maxPlaylists;
        this.maxSongsPerPlaylist = maxSongsPerPlaylist;
        this.cache = new Map(); // userId -> userData
        this.ensureDataFile();
        this.loadCache();
    }

    ensureDataFile() {
        const dir = path.dirname(this.dataFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (!fs.existsSync(this.dataFile)) {
            fs.writeFileSync(this.dataFile, JSON.stringify({}), 'utf8');
        }
    }

    loadCache() {
        try {
            const content = fs.readFileSync(this.dataFile, 'utf8');
            const data = JSON.parse(content);
            this.cache = new Map(Object.entries(data));
        } catch (error) {
            console.error('Failed to load favorites:', error);
            this.cache = new Map();
        }
    }

    saveCache() {
        try {
            const data = Object.fromEntries(this.cache);
            fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2), 'utf8');
            return true;
        } catch (error) {
            console.error('Failed to save favorites:', error);
            return false;
        }
    }

    getUserData(userId) {
        if (!this.cache.has(userId)) {
            this.cache.set(userId, {
                favorites: [],
                playlists: {}
            });
        }
        return this.cache.get(userId);
    }

    /**
     * Add a song to user's favorites
     */
    addFavorite(userId, song) {
        const userData = this.getUserData(userId);
        
        // Check if already favorited
        if (userData.favorites.some(s => s.id === song.id)) {
            return { success: false, reason: 'Already in favorites' };
        }
        
        userData.favorites.push({
            id: song.id,
            title: song.title,
            url: song.url,
            duration: song.duration,
            addedAt: new Date().toISOString()
        });
        
        this.saveCache();
        return { success: true };
    }

    /**
     * Remove a song from user's favorites
     */
    removeFavorite(userId, songId) {
        const userData = this.getUserData(userId);
        const initialLength = userData.favorites.length;
        
        userData.favorites = userData.favorites.filter(s => s.id !== songId);
        
        if (userData.favorites.length === initialLength) {
            return { success: false, reason: 'Song not in favorites' };
        }
        
        this.saveCache();
        return { success: true };
    }

    /**
     * Get user's favorites
     */
    getFavorites(userId) {
        const userData = this.getUserData(userId);
        return userData.favorites;
    }

    /**
     * Create a new playlist
     */
    createPlaylist(userId, playlistName) {
        const userData = this.getUserData(userId);
        
        // Check playlist limit
        if (Object.keys(userData.playlists).length >= this.maxPlaylists) {
            return { success: false, reason: `Maximum ${this.maxPlaylists} playlists allowed` };
        }
        
        // Check if playlist already exists
        if (userData.playlists[playlistName]) {
            return { success: false, reason: 'Playlist already exists' };
        }
        
        userData.playlists[playlistName] = {
            name: playlistName,
            songs: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        this.saveCache();
        return { success: true };
    }

    /**
     * Delete a playlist
     */
    deletePlaylist(userId, playlistName) {
        const userData = this.getUserData(userId);
        
        if (!userData.playlists[playlistName]) {
            return { success: false, reason: 'Playlist not found' };
        }
        
        delete userData.playlists[playlistName];
        this.saveCache();
        return { success: true };
    }

    /**
     * Add song to playlist
     */
    addToPlaylist(userId, playlistName, song) {
        const userData = this.getUserData(userId);
        
        if (!userData.playlists[playlistName]) {
            return { success: false, reason: 'Playlist not found' };
        }
        
        const playlist = userData.playlists[playlistName];
        
        // Check song limit
        if (playlist.songs.length >= this.maxSongsPerPlaylist) {
            return { success: false, reason: `Maximum ${this.maxSongsPerPlaylist} songs per playlist` };
        }
        
        // Check if already in playlist
        if (playlist.songs.some(s => s.id === song.id)) {
            return { success: false, reason: 'Song already in playlist' };
        }
        
        playlist.songs.push({
            id: song.id,
            title: song.title,
            url: song.url,
            duration: song.duration,
            addedAt: new Date().toISOString()
        });
        
        playlist.updatedAt = new Date().toISOString();
        this.saveCache();
        return { success: true };
    }

    /**
     * Remove song from playlist
     */
    removeFromPlaylist(userId, playlistName, songId) {
        const userData = this.getUserData(userId);
        
        if (!userData.playlists[playlistName]) {
            return { success: false, reason: 'Playlist not found' };
        }
        
        const playlist = userData.playlists[playlistName];
        const initialLength = playlist.songs.length;
        
        playlist.songs = playlist.songs.filter(s => s.id !== songId);
        
        if (playlist.songs.length === initialLength) {
            return { success: false, reason: 'Song not in playlist' };
        }
        
        playlist.updatedAt = new Date().toISOString();
        this.saveCache();
        return { success: true };
    }

    /**
     * Get a specific playlist
     */
    getPlaylist(userId, playlistName) {
        const userData = this.getUserData(userId);
        return userData.playlists[playlistName] || null;
    }

    /**
     * Get all playlists for a user
     */
    getPlaylists(userId) {
        const userData = this.getUserData(userId);
        return Object.values(userData.playlists);
    }

    /**
     * Rename a playlist
     */
    renamePlaylist(userId, oldName, newName) {
        const userData = this.getUserData(userId);
        
        if (!userData.playlists[oldName]) {
            return { success: false, reason: 'Playlist not found' };
        }
        
        if (userData.playlists[newName]) {
            return { success: false, reason: 'New name already exists' };
        }
        
        userData.playlists[newName] = userData.playlists[oldName];
        userData.playlists[newName].name = newName;
        userData.playlists[newName].updatedAt = new Date().toISOString();
        delete userData.playlists[oldName];
        
        this.saveCache();
        return { success: true };
    }

    /**
     * Get statistics
     */
    getStats() {
        let totalUsers = 0;
        let totalFavorites = 0;
        let totalPlaylists = 0;
        let totalSongs = 0;
        
        for (const userData of this.cache.values()) {
            totalUsers++;
            totalFavorites += userData.favorites.length;
            totalPlaylists += Object.keys(userData.playlists).length;
            
            for (const playlist of Object.values(userData.playlists)) {
                totalSongs += playlist.songs.length;
            }
        }
        
        return {
            totalUsers,
            totalFavorites,
            totalPlaylists,
            totalSongs
        };
    }
}

module.exports = FavoritesManager;
