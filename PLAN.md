# Music Addon - Feature Implementation Plan

## Status Legend
- ⏳ **Pending** - Not started yet
- 🚧 **In Progress** - Currently being implemented
- ✅ **Completed** - Feature implemented and tested
- 🔧 **Configurable** - Can be enabled/disabled in config.yml

---

## Phase 1: Core Feature Enhancements (High Priority)

### 1.1 Seek/Fast-Forward Command ✅ 🔧
**Description:** Allow users to skip to specific time in current song  
**Commands:** `/seek time:1:30` or `/seek seconds:90`  
**Config Options:**
- `seek_enabled: true/false`
- `seek_admin_only: true/false`

**Implementation:** COMPLETED
- Added seek command in `cmds/cmd_seek.js`
- Time format validation (MM:SS or seconds)
- Bounds checking

---

### 1.2 History Tracking ✅ 🔧
**Description:** Track and display recently played songs  
**Commands:** `/history [limit]`  
**Config Options:**
- `history_enabled: true/false`
- `history_max_entries: 50`
- `history_show_requester: true/false`

**Implementation:** COMPLETED
- Added history array to MusicPlayer class
- Store: {title, url, requester, timestamp}
- Added history command in `cmds/cmd_history.js`
- Allow replay from history

---

### 1.3 Queue Persistence ✅ 🔧
**Description:** Save queue to file, restore on restart  
**Config Options:**
- `queue_persistence_enabled: true/false`
- `queue_persistence_file: "data/queues.json"`
- `auto_restore_on_restart: true/false`

**Implementation:** COMPLETED
- Created `utils/persistenceUtils.js`
- Auto-save queue on changes
- `/savequeue` and `/restorequeue` commands
- Per-guild queue storage

---

### 1.4 Preemptive Downloading ✅ 🔧
**Description:** Download next songs while current plays  
**Config Options:**
- `preemptive_download_enabled: true/false`
- `preemptive_download_count: 2` (how many songs ahead)

**Implementation:** COMPLETED
- Background download of next N songs
- Track downloading to avoid duplicates
- Automatic cache management
- Error handling for failed downloads

---

## Phase 2: User Experience & Engagement

### 2.1 Favorites System ✅ 🔧
**Description:** Personal playlists for users  
**Commands:** `/favorite`, `/favorites`, `/playlist create/add/show/play/delete/rename/list`  
**Config Options:**
- `favorites_enabled: true/false`
- `max_playlists_per_user: 10`
- `max_songs_per_playlist: 100`

**Implementation:** COMPLETED
- Created `utils/favoritesManager.js`
- `/favorite` - Add current song to favorites
- `/favorites` - Show all favorites
- `/playlist` - Full playlist management
  - create, delete, add, remove, show, play, list, rename
- Storage in `data/favorites.json`
- Per-user favorites and playlists

---

### 2.2 Lyrics Fetching ⏳ 🔧
**Description:** Display song lyrics  
**Commands:** `/lyrics [query]`  
**Config Options:**
- `lyrics_enabled: true/false`
- `lyrics_api_key: ""` (Genius API)
- `lyrics_show_embed: true/false`

**Implementation:**
- Integrate Genius API
- Search by current song title/artist
- Display in paginated embeds
- Fallback to web search if API fails

---

### 2.3 Audio Effects ✅ 🔧
**Description:** Apply audio filters (nightcore, bass boost, etc.)  
**Commands:** `/effect set/remove/list/current`  
**Config Options:**
- `audio_effects_enabled: true/false`
- `audio_effects.admin_only: false`
- `audio_effects.available_effects: [...]`

**Implementation:** COMPLETED
- Created `utils/audioEffects.js` with 12 effects:
  - nightcore, bassboost, 8d, vaporwave, treble, echo
  - reverb, chipmunk, deepvoice, distortion, tremolo, vibrato
- Uses FFmpeg audio filters via prism-media
- Per-user effect preferences
- `/effect set` - Apply effect to your playback
- `/effect remove` - Remove current effect
- `/effect list` - Show all available effects
- `/effect current` - Show your active effect
- Effects persist across songs
- Integrated into audio resource creation

---

### 2.4 Rich Now Playing Display ⏳ 🔧
**Description:** Auto-updating embed with progress bar  
**Config Options:**
- `rich_nowplaying_enabled: true/false`
- `nowplaying_update_interval: 10` (seconds)
- `show_progress_bar: true/false`

**Implementation:**
- Create updating embed
- Show: █████████░░░░░ 01:25 / 03:40
- Update every N seconds
- Delete on song change

---

### 2.5 Radio Mode ⏳ 🔧
**Description:** Continuous playback based on seed  
**Commands:** `/radio start [query]`, `/radio stop`  
**Config Options:**
- `radio_enabled: true/false`
- `radio_queue_refill_at: 5` (songs remaining)
- `radio_fetch_count: 10` (songs to add)

**Implementation:**
- Use YouTube recommendations
- Auto-add songs when queue low
- Show radio mode indicator
- Disable when user adds manual songs

---

## Phase 3: Performance & Reliability

### 3.1 Connection Recovery ✅ 🔧
**Description:** Auto-reconnect on voice disconnect  
**Config Options:**
- `auto_reconnect_enabled: true/false`
- `reconnect_attempts: 3`
- `reconnect_delay_seconds: 5`

**Implementation:** COMPLETED
- Listen for connection destroyed event
- Attempt to rejoin voice channel with retries
- Resume playback after reconnection
- Notify users of reconnection status

---

### 3.2 Smart Cache Management ⏳ 🔧
**Description:** Track popularity, keep frequent songs  
**Commands:** `/cache stats`, `/cache clear`  
**Config Options:**
- `smart_cache_enabled: true/false`
- `cache_popular_threshold: 3` (play count)
- `cache_max_size_mb: 1000`

**Implementation:**
- Track play count per video ID
- Keep frequently played songs
- Show cache stats (size, hits, misses)
- Admin cache clear command

---

### 3.3 Rate Limiting ✅ 🔧
**Description:** Prevent command spam  
**Config Options:**
- `rate_limiting_enabled: true/false`
- `rate_limit_commands_per_minute: 10`
- `rate_limit_play_per_minute: 5`
- `rate_limit_exempt_roles: []`

**Implementation:** COMPLETED
- Created `utils/rateLimitUtils.js`
- Track command usage per user
- Sliding window algorithm
- Role-based exemptions

---

### 3.4 Duplicate Detection ✅ 🔧
**Description:** Warn if song already in queue  
**Config Options:**
- `duplicate_detection_enabled: true/false`
- `allow_duplicates: false`
- `duplicate_warning_only: true` (vs block)

**Implementation:** COMPLETED
- Check queue for matching video IDs
- Show position if exists
- Configurable warning vs block mode
- Count duplicates in stats

---

## Phase 4: Analytics & Monitoring

### 4.1 Statistics Tracking ✅ 🔧
**Description:** Track usage metrics  
**Commands:** `/stats [server|personal|top]`  
**Config Options:**
- `statistics_enabled: true/false`
- `stats_track_plays: true`
- `stats_track_users: true`
- `stats_leaderboard_size: 10`

**Implementation:** COMPLETED
- Created `data/statistics.json`
- Track: song plays, user activity, queue adds
- Show leaderboards
- Server/personal/top stats

---

### 4.2 User Volume Preferences ✅ 🔧
**Description:** Remember preferred volume per user  
**Config Options:**
- `user_volume_preferences_enabled: true/false`
- `volume_preference_default: 50`

**Implementation:** COMPLETED
- Created `utils/volumePreferences.js`
- Store in `data/volume_prefs.json`
- Auto-apply when user queues song
- Save on volume change

---

### 4.3 Auto-Queue Suggestions ⏳ 🔧
**Description:** Suggest similar tracks after playlist  
**Config Options:**
- `auto_queue_suggestions_enabled: true/false`
- `suggestions_prompt_user: true` (vs auto-add)

**Implementation:**
- Detect when Spotify playlist ends
- Fetch related tracks
- Button prompt: "Continue with similar music?"
- Add to queue on confirmation

---

## Phase 5: Advanced Features

### 5.1 Quality Selection ⏳ 🔧
**Description:** Configure audio quality  
**Config Options:**
- `audio_quality: "high"` (high/medium/low)
- `max_bitrate_kbps: 320`

**Implementation:**
- Pass quality params to yt-dlp
- Balance quality vs file size
- Show quality in download message

---

### 5.2 Better Error Recovery ⏳ 🔧
**Description:** Retry with exponential backoff  
**Config Options:**
- `error_retry_enabled: true/false`
- `error_retry_max_attempts: 3`
- `error_retry_backoff_seconds: 2`

**Implementation:**
- Retry failed downloads
- Exponential delay: 2s, 4s, 8s
- Log to error file
- Notify after max attempts

---

### 5.3 Queue Filtering ⏳ 🔧
**Description:** Filter queue display  
**Commands:** `/queue user:@someone`, `/queue mine`  
**Config Options:**
- `queue_filtering_enabled: true/false`

**Implementation:**
- Add filter options to queue command
- Filter by requester
- Show filtered count
- Highlight filtered songs

---

## Implementation Priority

### Week 1 (Quick Wins) ✅ COMPLETED
1. ✅ Cache optimization
2. ✅ History tracking
3. ✅ Seek command
4. ✅ Duplicate detection

### Week 2 (Core Features) ✅ COMPLETED
5. ✅ Queue persistence
6. ✅ Preemptive downloading
7. ✅ Statistics tracking
8. ✅ Rate limiting

### Week 3 (User Experience) ✅ COMPLETED
9. ✅ User volume preferences
10. ✅ Connection recovery
11. ✅ Favorites & Playlists
12. ✅ Audio effects

### Week 4 (Advanced) - PENDING
13. ⏳ Rich now playing
14. ⏳ Radio mode
15. ⏳ Lyrics fetching
16. ⏳ Smart cache management

---

## Config File Structure Addition

```yaml
# Feature flags
features:
  seek_enabled: true
  history_enabled: true
  queue_persistence_enabled: true
  preemptive_download_enabled: true
  favorites_enabled: true
  lyrics_enabled: false
  effects_enabled: true
  radio_enabled: true
  auto_reconnect_enabled: true
  smart_cache_enabled: true
  rate_limiting_enabled: true
  duplicate_detection_enabled: true
  statistics_enabled: true
  user_volume_preferences_enabled: true
  auto_queue_suggestions_enabled: false

# Feature-specific settings
seek:
  admin_only: false

history:
  max_entries: 50
  show_requester: true

queue_persistence:
  file: "data/queues.json"
  auto_restore_on_restart: true

preemptive_download:
  count: 2

favorites:
  max_playlists_per_user: 10
  max_songs_per_playlist: 100

lyrics:
  api_key: ""
  show_embed: true

effects:
  admin_only: false
  available_effects: ["nightcore", "bassboost", "8d", "vaporwave"]

radio:
  queue_refill_at: 5
  fetch_count: 10

nowplaying:
  update_interval: 10
  show_progress_bar: true

auto_reconnect:
  attempts: 3
  delay_seconds: 5

smart_cache:
  popular_threshold: 3
  max_size_mb: 1000

rate_limiting:
  commands_per_minute: 10
  play_per_minute: 5
  exempt_roles: []

duplicate_detection:
  allow_duplicates: false
  warning_only: true

audio_quality: "high"
max_bitrate_kbps: 320

user_volume:
  default: 50
```

---

## Notes
- All features must be independently configurable
- Each feature should have enable/disable flag
- Maintain backwards compatibility
- Document all config options
- Add error handling for disabled features
- Test each feature in isolation
