# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WatchParty is a **self-hosted watch party platform** that synchronizes video playback across multiple users in real-time. The host controls playback (play/pause/seek) for all participants, with support for co-host permissions, YouTube and Plex video sources, and real-time chat.

**Stack**: Next.js 15.1.3 (React 19), TypeScript, Prisma ORM, PostgreSQL, Redis, Socket.io, Tailwind CSS, Docker

## Common Commands

```bash
# Development
npm run dev              # Start dev server on :3000

# Production
npm run build            # Compile TS, generate Prisma client, build Next.js
npm run start            # Start production server

# Database
npm run db:push          # Apply Prisma schema to PostgreSQL
npm run db:studio        # Open Prisma Studio (visual DB admin)

# Code Quality
npm run lint             # Run ESLint

# Docker (full stack)
docker-compose up -d     # Start app + PostgreSQL + Redis
docker-compose down      # Stop services
```

## Architecture

### Core Directories
- `src/app/` - Next.js App Router pages and API routes
- `src/components/` - React components (WatchPartyRoom is the main container)
- `src/lib/` - Utility modules: socket-server.ts, socket-events.ts, room.ts, participant.ts, plex-auth.ts, plex.ts
- `src/hooks/` - React hooks: useSocket.ts (WebSocket client), usePlaybackSync.ts (video sync)
- `src/middleware.ts` - Admin route protection
- `prisma/schema.prisma` - Database schema (Room, Participant, PlexConnection models)
- `cluster.js` - Node.js cluster entry point (4 workers)

### Key Routes
- `/` - Public room listing and join with room code
- `/watch/[slug]` - Watch party room with video player, chat, and participant list
- `/admin/(protected)/create-room` - Create new watch party rooms (protected if ADMIN_PASSWORD set)
- `/api/rooms` - Room CRUD operations
- `/api/rooms/join` - Join room with room code
- `/api/plex/auth/*` - Plex OAuth 2.0 flow
- `/api/plex/servers` - List Plex servers
- `/api/plex/libraries` - List Plex libraries
- `/api/plex/library/[id]/videos` - Browse videos in library
- `/api/plex/video/[ratingKey]` - Get video playback URL

### Synchronization Logic

The sync mechanism uses **host-controlled state** instead of time-based sync:

1. **Host actions** (play/pause/seek) emit events to Socket.io server
2. **Server validates** permissions and updates Room state in PostgreSQL
3. **Server broadcasts** playback state to all participants in room
4. **Clients receive** state via WebSocket and sync their video players
5. **Drift correction** runs periodically (500ms tolerance for YouTube)

**Key files:**
- `src/lib/socket-events.ts` - Server-side event handlers
- `src/hooks/useSocket.ts` - Client-side WebSocket connection
- `src/hooks/usePlaybackSync.ts` - Video player synchronization
- `src/components/VideoPlayer/*` - Multi-source video player abstraction

### WebSocket Events

**Client → Server:**
- `room:join` - Join room with display name
- `room:leave` - Leave room
- `playback:play/pause/seek` - Host/co-host playback controls
- `chat:message` - Send chat message
- `participant:grant_control/revoke_control` - Host grants/revokes co-host
- `host:transfer` - Host transfers host permissions

**Server → Client:**
- `playback:state` - Broadcast playback state changes
- `chat:new` - New chat message
- `chat:history` - Chat history on join
- `participant:list` - Updated participant list
- `host:changed` - Host changed notification
- `you_are_host` - You've been made host
- `control:granted/revoked` - Co-host permission changed
- `error` - Error message

### Video Player Abstraction

Multi-source support via common `VideoPlayerHandle` interface:

- **YouTube**: YouTube IFrame API with ~250ms precision
- **Plex**: HTML5 video element with transcoding support

**Files:**
- `src/components/VideoPlayer/types.ts` - Common interface
- `src/components/VideoPlayer/YouTubePlayer.tsx` - YouTube implementation
- `src/components/VideoPlayer/PlexPlayer.tsx` - Plex implementation
- `src/components/VideoPlayer/index.tsx` - Source-based factory

### Authentication & Permissions

**Admin Protection:**
- `ADMIN_PASSWORD` env var protects `/admin/(protected)/*` routes
- Sessions stored in Redis (24hr TTL) with in-memory fallback
- Rate limiting: 5 login attempts per IP per 15 minutes

**Room Permissions:**
- **Host**: Full control (play/pause/seek, grant/revoke co-host, transfer host, delete room)
- **Co-host**: Playback control (play/pause/seek)
- **Viewer**: Watch only

**Host Transfer:**
- Automatic when host leaves: co-host → oldest participant → delete if temporary room
- Manual transfer by host
- 30-second grace period before temporary room deletion

### Chat System

- **Storage**: Redis lists (`chat:{roomId}`)
- **Limit**: 100 messages per room (LTRIM)
- **TTL**: 24h (persistent), 1h (temporary)
- **Character limit**: 500 per message
- Real-time broadcast via Socket.io

### Plex Integration

**OAuth 2.0 Flow:**
1. Client requests PIN via `/api/plex/auth/start`
2. User authorizes via Plex website (popup)
3. Client polls `/api/plex/auth/check` every 5 seconds
4. Server stores `PlexConnection` in database on success

**Library Browsing:**
1. List servers via `/api/plex/servers`
2. Select server, list libraries via `/api/plex/libraries`
3. Browse videos via `/api/plex/library/[id]/videos`
4. Get playback URL via `/api/plex/video/[ratingKey]`

**Security:**
- Backend proxies all Plex API requests
- Tokens never exposed to frontend
- Per-session PlexConnection storage

## Environment Variables

All optional with Docker defaults:

```
PORT=3000                           # Server port
POSTGRES_PASSWORD=watchparty        # PostgreSQL password (change in prod!)
DATABASE_URL=postgresql://...       # PostgreSQL connection
REDIS_URL=redis://localhost:6379    # Redis connection
ADMIN_PASSWORD=                     # Protects /admin if set
SECURE_COOKIES=                     # Set "true" for HTTPS
NEXT_PUBLIC_PLEX_CLIENT_ID=         # Custom Plex client ID (optional)
```

## TypeScript Path Alias

`@/*` maps to `./src/*` - use `@/lib/db` instead of relative paths.

## Database Schema

Three models in `prisma/schema.prisma`:

### Room
- **Identity**: id (cuid), slug (unique, URL-friendly), roomCode (6-char for private)
- **Type**: isPublic (list on homepage), isPersistent (don't auto-delete)
- **Video**: videoType ("youtube"|"plex"), videoId, videoUrl, videoDuration
- **Plex**: plexServerUrl, plexToken, plexServerId (null for YouTube)
- **State**: isPlaying, currentPosition, lastUpdated
- **Relations**: hostId (Participant), participants (Participant[])

### Participant
- **Identity**: id (cuid), displayName, sessionId (browser)
- **Permissions**: isHost, canControl (co-host)
- **Status**: isOnline, joinedAt, lastSeenAt
- **Relations**: roomId (Room)

### PlexConnection
- **Identity**: id (cuid), sessionId (browser)
- **Auth**: plexToken, plexUsername
- **Selection**: selectedServerId, selectedServerUrl
- **Expiry**: expiresAt (optional)

## Scaling Considerations

**Horizontal Scaling:**
- Socket.io Redis adapter enables multi-worker/multi-server scaling
- Redis pub/sub for cross-worker event broadcasting
- PostgreSQL for shared state across workers

**Performance:**
- Chat limited to 100 messages (Redis LTRIM)
- Participant list capped at reasonable size
- Heartbeat interval: 30 seconds
- Sync interval: ~250ms for YouTube, ~100ms for Plex

**Cleanup:**
- Stale participants: 2-minute timeout (marked offline)
- Temporary rooms: Delete when last participant leaves (30s grace)
- Chat TTL: 1h (temporary), 24h (persistent)

## Development Notes

**Display Names:**
- Stored in localStorage (`watchparty_displayName`)
- No user accounts or authentication for viewers
- Admin creates rooms, viewers join with simple names

**Room Codes:**
- 6 characters: uppercase letters + numbers
- Excludes ambiguous: 0, O, 1, I, L
- Private rooms only (public rooms have no code)

**Session Management:**
- 32-byte hex sessionId generated on first visit
- Stored in sessionStorage (browser-scoped)
- Enables reconnection with same participant record

## Common Tasks

**Create a room:**
1. Navigate to `/admin/(protected)/create-room`
2. Enter room name and display name
3. Choose video source (YouTube URL or Plex library)
4. Configure: public/private, persistent/temporary
5. Click "Create Watch Party"

**Join a room:**
- **Public**: Click room on homepage
- **Private**: Enter 6-char room code on homepage

**Grant co-host:**
- Host clicks "Make Co-Host" on participant in list

**Transfer host:**
- Host clicks "Make Host" on participant in list

## Troubleshooting

**Socket.io not connecting:**
- Check Redis is running: `docker-compose ps`
- Verify REDIS_URL environment variable
- Check browser console for WebSocket errors

**Plex authentication fails:**
- Ensure Plex server is accessible
- Try direct URL instead of relay (*.plex.direct)
- Check network connectivity to plex.tv

**Video won't play:**
- **YouTube**: Check video is not age-restricted or private
- **Plex**: Ensure transcoding is enabled on server
- Check browser console for player errors

**Database errors:**
- Run `npm run db:push` to apply schema
- Check DATABASE_URL is correct
- Verify PostgreSQL is running: `docker-compose ps`

## References

See `TRANSFORMATION_COMPLETE.md` for complete transformation documentation, including all features, API endpoints, and architecture decisions.
