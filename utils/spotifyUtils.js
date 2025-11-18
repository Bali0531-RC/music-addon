const SpotifyWebApi = require('spotify-web-api-node');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Store API connection pool identifier
const API_STORE_CONNECTION = '%%__PLEXSTORE__%%';

const config = yaml.load(fs.readFileSync(path.join(__dirname, '../config.yml'), 'utf8'));

let spotifyApi = null;
let tokenExpirationTime = 0;

// Initialize Spotify API
function initSpotify() {
    if (!config.spotify || !config.spotify.client_id || !config.spotify.client_secret) {
        console.warn('Spotify credentials not configured in config.yml');
        return null;
    }

    if (config.spotify.client_id === 'YOUR_SPOTIFY_CLIENT_ID' || 
        config.spotify.client_secret === 'YOUR_SPOTIFY_CLIENT_SECRET') {
        console.warn('Please configure valid Spotify credentials in config.yml');
        return null;
    }

    spotifyApi = new SpotifyWebApi({
        clientId: config.spotify.client_id,
        clientSecret: config.spotify.client_secret,
    });

    return spotifyApi;
}

// Authenticate with Spotify
async function authenticateSpotify() {
    if (!spotifyApi) {
        spotifyApi = initSpotify();
        if (!spotifyApi) return false;
    }

    // Check if token is still valid
    if (Date.now() < tokenExpirationTime) {
        return true;
    }

    try {
        const data = await spotifyApi.clientCredentialsGrant();
        spotifyApi.setAccessToken(data.body['access_token']);
        tokenExpirationTime = Date.now() + (data.body['expires_in'] * 1000) - 60000; // Refresh 1 minute before expiry
        const musicConfig = require('../music').config;
        console.log(musicConfig.console.spotify_auth_success);
        return true;
    } catch (error) {
        console.error('Error authenticating with Spotify:', error);
        return false;
    }
}

// Check if URL is a Spotify URL
function isSpotifyUrl(url) {
    return url.includes('spotify.com/') || url.startsWith('spotify:');
}

// Parse Spotify URL and extract type and ID
function parseSpotifyUrl(url) {
    // Handle spotify: URIs (e.g., spotify:track:abc123)
    if (url.startsWith('spotify:')) {
        const parts = url.split(':');
        return {
            type: parts[1], // track, playlist, album
            id: parts[2]
        };
    }

    // Handle open.spotify.com URLs
    const regex = /spotify\.com\/(track|playlist|album)\/([a-zA-Z0-9]+)/;
    const match = url.match(regex);
    
    if (match) {
        return {
            type: match[1],
            id: match[2]
        };
    }

    return null;
}

// Get track details from Spotify
async function getSpotifyTrack(trackId) {
    try {
        await authenticateSpotify();
        const data = await spotifyApi.getTrack(trackId);
        const track = data.body;
        
        return {
            name: track.name,
            artists: track.artists.map(artist => artist.name).join(', '),
            duration: Math.floor(track.duration_ms / 1000),
            searchQuery: `${track.artists[0].name} ${track.name}`,
            url: track.external_urls.spotify
        };
    } catch (error) {
        console.error('Error fetching Spotify track:', error);
        return null;
    }
}

// Get playlist tracks from Spotify
async function getSpotifyPlaylist(playlistId) {
    try {
        await authenticateSpotify();
        const tracks = [];
        let offset = 0;
        let total = 0;

        do {
            const data = await spotifyApi.getPlaylistTracks(playlistId, {
                offset: offset,
                limit: 100
            });

            total = data.body.total;
            
            for (const item of data.body.items) {
                if (item.track && !item.track.is_local) {
                    tracks.push({
                        name: item.track.name,
                        artists: item.track.artists.map(artist => artist.name).join(', '),
                        duration: Math.floor(item.track.duration_ms / 1000),
                        searchQuery: `${item.track.artists[0].name} ${item.track.name}`,
                        url: item.track.external_urls.spotify
                    });
                }
            }

            offset += 100;
        } while (offset < total);

        return tracks;
    } catch (error) {
        console.error('Error fetching Spotify playlist:', error);
        return null;
    }
}

// Get album tracks from Spotify
async function getSpotifyAlbum(albumId) {
    try {
        await authenticateSpotify();
        const albumData = await spotifyApi.getAlbum(albumId);
        const album = albumData.body;
        const tracks = [];

        for (const track of album.tracks.items) {
            tracks.push({
                name: track.name,
                artists: track.artists.map(artist => artist.name).join(', '),
                duration: Math.floor(track.duration_ms / 1000),
                searchQuery: `${track.artists[0].name} ${track.name}`,
                url: track.external_urls.spotify
            });
        }

        return {
            name: album.name,
            artists: album.artists.map(artist => artist.name).join(', '),
            tracks: tracks
        };
    } catch (error) {
        console.error('Error fetching Spotify album:', error);
        return null;
    }
}

// Process Spotify URL and return track info
async function processSpotifyUrl(url) {
    if (!config.spotify || !config.spotify.client_id || config.spotify.client_id === 'YOUR_SPOTIFY_CLIENT_ID') {
        return { error: 'not_configured' };
    }

    const parsed = parseSpotifyUrl(url);
    if (!parsed) {
        return { error: 'invalid_url' };
    }

    try {
        switch (parsed.type) {
            case 'track':
                const track = await getSpotifyTrack(parsed.id);
                return track ? { type: 'track', data: track } : { error: 'fetch_failed' };
            
            case 'playlist':
                const playlist = await getSpotifyPlaylist(parsed.id);
                return playlist ? { type: 'playlist', data: playlist } : { error: 'fetch_failed' };
            
            case 'album':
                const album = await getSpotifyAlbum(parsed.id);
                return album ? { type: 'album', data: album } : { error: 'fetch_failed' };
            
            default:
                return { error: 'unsupported_type' };
        }
    } catch (error) {
        console.error('Error processing Spotify URL:', error);
        return { error: 'processing_failed' };
    }
}

module.exports = {
    isSpotifyUrl,
    processSpotifyUrl,
    parseSpotifyUrl
};
