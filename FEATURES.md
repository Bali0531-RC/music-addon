# Music Addon Features

## Core Playback
- **Play Music** - Play songs from YouTube or Spotify URLs/search queries
- **Pause/Resume** - Pause and resume playback with state persistence
- **Skip** - Skip to the next song in queue
- **Stop** - Stop playback and clear queue
- **Volume Control** - Set volume from 0-100%
- **Loop Mode** - Toggle repeat for current song
- **Seek** - Jump to specific timestamp in current song (MM:SS or seconds)

## Queue Management
- **Queue Display** - View all songs in queue with positions
- **Queue Size Limit** - Configurable maximum queue size (default: 100)
- **Shuffle** - Randomize queue order
- **Clear Queue** - Remove all songs from queue
- **Queue Persistence** - Automatically save and restore queue on bot restart
- **Preemptive Download** - Download next N songs in advance for seamless playback
- **Duplicate Detection** - Warn when adding songs already in queue

## Spotify Integration
- **Spotify Tracks** - Play individual Spotify songs
- **Spotify Playlists** - Add entire Spotify playlists to queue
- **Spotify Albums** - Add full Spotify albums to queue
- **Automatic Conversion** - Converts Spotify tracks to YouTube for playback

## User Features
- **Now Playing Display** - Shows current song with details
- **Rich Now Playing** - Auto-updating embed with progress bar (█████████░░░░░) and timestamps
- **Play History** - Track and display recently played songs (up to 50)
- **Search Results** - Interactive search with 7 results to choose from
- **User Volume Preferences** - Remember each user's preferred volume setting
- **Statistics** - View server-wide and personal playback stats
- **Top Songs Leaderboard** - See most played songs with play counts

## Playlists & Favorites
- **Personal Favorites** - Save your favorite songs
- **Custom Playlists** - Create and manage multiple playlists (up to 10 per user)
- **Playlist Management** - Add, remove, rename, and play from playlists
- **Playlist Limits** - Up to 100 songs per playlist

## Audio Effects
- **Nightcore** - Speed up tempo and raise pitch
- **Bass Boost** - Amplify low frequencies
- **8D Audio** - Create surround sound effect
- **Vaporwave** - Slow down tempo and lower pitch
- **Treble Boost** - Amplify high frequencies
- **Echo** - Add echo effect
- **Reverb** - Add reverb/hall effect
- **Chipmunk** - High-pitched voice effect
- **Deep Voice** - Low-pitched voice effect
- **Distortion** - Add distortion effect
- **Tremolo** - Rapid volume variation
- **Vibrato** - Pitch oscillation effect

## Advanced Features
- **Radio Mode** - Auto-play similar songs based on seed track
- **Auto Queue Refill** - Automatically add related songs when queue runs low
- **Lyrics Display** - Fetch and display song lyrics from Genius API
- **Smart Cache Management** - Track popular songs and keep frequently played tracks cached
- **Cache Statistics** - View cache size, hit rate, and popular files
- **Connection Recovery** - Auto-reconnect on voice disconnect with retry logic
- **Rate Limiting** - Prevent command spam with configurable limits
- **Whitelist/Blacklist** - Control who can use music commands

## Technical Features
- **Age-Restricted Bypass** - Automatically skip age-restricted videos
- **Unavailable Video Handling** - Auto-skip unavailable/private videos and try alternatives
- **Retry Logic** - Up to 3 retry attempts for failed downloads
- **File Size Limit** - Configurable max download size (default: 500MB)
- **Song Duration Limit** - Set maximum song length (default: 30 minutes)
- **Auto Cleanup** - Delete temporary files on startup and after playback
- **Voice Channel Validation** - Ensure users are in same channel as bot
- **Permission Checks** - Verify bot has join/speak permissions
- **Admin Roles** - Special permissions for admins to bypass restrictions

## Configuration
- **Feature Flags** - Enable/disable any feature individually
- **Customizable Messages** - All user-facing text configurable
- **Embed Colors** - Customize success/error/info/warning colors
- **Command Names** - Rename commands to avoid conflicts
- **Timeouts** - Configure disconnect timeout and search timeout
- **Storage Paths** - Custom paths for data files and cache

## Statistics & Monitoring
- **Play Count Tracking** - Track how many times each song is played
- **User Activity Tracking** - Monitor which users request songs
- **Top Requesters** - See who requests the most songs
- **Cache Hit Rate** - Monitor cache performance with hits/misses
- **Leaderboards** - Display top songs and users with configurable size

## Total: 70+ Features
