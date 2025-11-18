# 🎵 Discord Music Bot Addon

A feature-rich Discord music bot with YouTube and Spotify support, featuring advanced queue management, statistics tracking, and highly configurable options.

## ✨ Features

### 🎶 Core Music Features
- ✅ **YouTube Support** - Play songs from YouTube URLs or search queries
- ✅ **Spotify Integration** - Support for Spotify tracks, playlists, and albums
- ✅ **Smart Caching** - Reuse downloaded files to save bandwidth and time
- ✅ **Auto-cleanup** - Automatic cleanup of temporary files
- ✅ **Queue Management** - Full queue control with shuffle, clear, skip
- ✅ **Loop Mode** - Loop the current song
- ✅ **Volume Control** - Adjust playback volume

### 🚀 Advanced Features
- ✅ **History Tracking** - View recently played songs with `/history`
- ✅ **Seek Command** - Jump to any time in the current song with `/seek`
- ✅ **Statistics** - Track play counts, top songs, and user activity with `/stats`
- ✅ **Duplicate Detection** - Warns when adding songs already in queue
- ✅ **Rate Limiting** - Prevents command spam
- ✅ **Access Control** - Whitelist/blacklist users and roles
- ✅ **Admin Controls** - Special permissions for admin roles
- ✅ **Voice Channel Restrictions** - Users must be in same channel as bot

### 🎯 Coming Soon
- 🔜 **Favorites & Playlists** - Save personal playlists
- 🔜 **Queue Persistence** - Save/restore queue on restart
- 🔜 **Preemptive Download** - Download next songs in advance
- 🔜 **Audio Effects** - Nightcore, bass boost, 8D audio
- 🔜 **Lyrics Display** - Show song lyrics
- 🔜 **Radio Mode** - Auto-play similar songs
- 🔜 **User Volume Preferences** - Remember preferred volumes

## 📋 Commands

| Command | Description | Options |
|---------|-------------|---------|
| `/play <query>` | Play a song from YouTube/Spotify | URL or search query |
| `/pause` | Pause the current song | - |
| `/resume` | Resume playback | - |
| `/skip` | Skip the current song | - |
| `/stop` | Stop playback and clear queue | - |
| `/queue` | Show the current queue | - |
| `/nowplaying` | Show currently playing song | - |
| `/volume <level>` | Set volume (0-100) | Volume level |
| `/loop` | Toggle loop mode | - |
| `/shuffle` | Shuffle the queue | - |
| `/clear` | Clear the entire queue | - |
| `/history [limit]` | Show recently played songs | Number of songs (default: 10) |
| `/seek <time>` | Jump to specific time | MM:SS or seconds (e.g., 1:30 or 90) |
| `/stats [type]` | Show statistics | server/personal/top |

## ⚙️ Configuration

All features are fully configurable in `config.yml`. You can enable/disable any feature and customize behavior:

### Feature Flags
```yaml
features:
  seek_enabled: true                    # Seek command
  history_enabled: true                 # History tracking
  duplicate_detection_enabled: true     # Duplicate warnings
  statistics_enabled: true              # Statistics tracking
  rate_limiting_enabled: true           # Command rate limiting
  # ... more features
```

### Access Control
```yaml
MusicBot:
  AdminRoles: []                        # Admin role IDs
  WhitelistEnabled: false               # Enable whitelist mode
  WhitelistedUsers: []                  # Whitelisted user IDs
  WhitelistedRoles: []                  # Whitelisted role IDs
  BlacklistedUsers: []                  # Blacklisted user IDs
  BlacklistedRoles: []                  # Blacklisted role IDs
```

### Rate Limiting
```yaml
rate_limiting:
  commands_per_minute: 10               # Max commands per user
  play_per_minute: 5                    # Max play commands per user
  exempt_roles: []                      # Roles exempt from limits
```

### Queue Settings
```yaml
max_queue_size: 100                     # Max songs in queue (0 = unlimited)
max_song_duration_minutes: 30           # Max song length (0 = unlimited)
disconnect_on_empty_queue: true         # Auto-disconnect when queue empty
```

### History Settings
```yaml
history:
  max_entries: 50                       # How many songs to remember
  show_requester: true                  # Show who requested each song
```

### Statistics Settings
```yaml
statistics:
  track_plays: true                     # Track song play counts
  track_users: true                     # Track user activity
  leaderboard_size: 10                  # Number of entries in leaderboards
```

### Duplicate Detection
```yaml
duplicate_detection:
  allow_duplicates: false               # Allow same song multiple times
  warning_only: true                    # Just warn vs block
```

### Seek Settings
```yaml
seek:
  admin_only: false                     # Restrict to admins only
```

## 🔧 Installation

### Prerequisites
- Node.js v16.9.0 or higher
- Discord.js v14
- yt-dlp installed on your system
- Spotify API credentials (optional, for Spotify support)

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/Bali0531-RC/music-addon.git
   cd music-addon
   ```

2. **Install dependencies**
   ```bash
   npm install discord.js @discordjs/voice youtube-dl-exec js-yaml spotify-web-api-node
   ```

3. **Install yt-dlp**
   ```bash
   # Linux/macOS
   sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
   sudo chmod a+rx /usr/local/bin/yt-dlp
   
   # Windows (with Chocolatey)
   choco install yt-dlp
   ```

4. **Configure the bot**
   - Edit `config.yml` with your settings
   - Add Spotify API credentials (if using Spotify features)
   - Configure feature flags, access control, and behavior settings

5. **Register commands**
   ```bash
   node register-commands.js
   ```

6. **Start the bot**
   ```bash
   node bot.js
   ```

## 🎨 Usage Examples

### Playing Music
```
/play https://www.youtube.com/watch?v=dQw4w9WgXcQ
/play Never Gonna Give You Up
/play https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT
/play https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
```

### Managing Queue
```
/queue                    # View current queue
/shuffle                  # Randomize queue order
/clear                    # Remove all songs from queue
/skip                     # Skip to next song
/loop                     # Toggle loop for current song
```

### Advanced Features
```
/history 20               # Show last 20 played songs
/seek 1:30                # Jump to 1 minute 30 seconds
/seek 90                  # Jump to 90 seconds
/stats server             # Show server-wide statistics
/stats personal           # Show your personal stats
/stats top                # Show top songs leaderboard
```

## 📊 Statistics Features

The bot tracks comprehensive statistics (when enabled):

- **Server Stats**: Total songs played, queue size, unique songs, top requesters
- **Personal Stats**: Your requested songs, your favorite songs
- **Top Songs**: Leaderboard of most played songs across server
- **Play Counts**: How many times each song has been played

## 🔒 Access Control

### Whitelist Mode
Enable whitelist mode to restrict bot usage to specific users/roles:
```yaml
MusicBot:
  WhitelistEnabled: true
  WhitelistedUsers: ["123456789012345678"]
  WhitelistedRoles: ["987654321098765432"]
```

### Blacklist
Ban specific users or roles from using the bot:
```yaml
MusicBot:
  BlacklistedUsers: ["123456789012345678"]
  BlacklistedRoles: ["987654321098765432"]
```

### Admin Privileges
Admins can:
- Control bot from any channel (bypass voice channel restriction)
- Use seek command when `admin_only` is enabled
- Bypass rate limiting when added to `exempt_roles`

## 🛠️ Development Roadmap

See `PLAN.md` for the complete feature implementation plan.

### Phase 1 (Completed ✅)
- ✅ History tracking
- ✅ Seek command
- ✅ Duplicate detection
- ✅ Statistics system
- ✅ Rate limiting
- ✅ Cache optimization

### Phase 2 (Next Up)
- 🔜 Favorites & playlists
- 🔜 Queue persistence
- 🔜 Preemptive downloading
- 🔜 User volume preferences

### Phase 3 (Future)
- 🔜 Audio effects
- 🔜 Lyrics display
- 🔜 Radio mode
- 🔜 Connection recovery

## 🐛 Troubleshooting

### Bot doesn't respond to commands
- Ensure commands are registered: `node register-commands.js`
- Check bot has proper permissions in Discord
- Verify `MusicBot.Enabled: true` in config.yml

### Songs won't play
- Ensure yt-dlp is installed and in PATH
- Check voice channel permissions
- Verify not in whitelist mode (or user is whitelisted)

### Age-restricted videos fail
- Set `skip_age_restricted: true` in config.yml
- Bot will automatically try alternative results

### Rate limit errors
- Adjust `rate_limiting.commands_per_minute` in config
- Add exempt roles if needed
- Or disable: `features.rate_limiting_enabled: false`

## 📝 License

This project is open source. See the repository for license details.

## 🤝 Contributing

Contributions are welcome! Please see `PLAN.md` for planned features and implementation details.

## 💬 Support

For issues, suggestions, or questions:
- Open an issue on GitHub
- Contact: bali0531 on Discord

## 🙏 Credits

- Built with Discord.js
- Uses yt-dlp for YouTube downloads
- Spotify integration via spotify-web-api-node
- Created by bali0531

---

**Note**: Make sure to configure `config.yml` before running the bot. All features are disabled by default and must be explicitly enabled.
