# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Simulive-test is a **simulated live streaming platform** that creates the illusion of a live broadcast by synchronizing all viewers to the same position in a pre-recorded video using the scheduled start time as reference.

**Stack**: Next.js 15.1.3 (React 19), TypeScript, Prisma ORM, PostgreSQL, Redis, Mux Video, Tailwind CSS, Docker

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
- `src/components/` - React components (SimulatedLivePlayer is the main player)
- `src/lib/` - Utility modules: simulive.ts (sync logic), mux.ts (API client), auth.ts (sessions), redis.ts (cache), db.ts (Prisma)
- `src/middleware.ts` - Admin route protection
- `prisma/schema.prisma` - Database schema (Stream, AuditLog models)
- `cluster.js` - Node.js cluster entry point (4 workers)

### Key Routes
- `/` - Stream listing (ISR 30s)
- `/watch/[slug]` - Viewer page (ISR 60s)
- `/embed/[slug]` - Embeddable player for iframes (minimal UI, no chrome)
- `/admin` - Stream management (protected if ADMIN_PASSWORD set)
- `/admin/audit` - Audit log viewer
- `/api/streams` - Stream CRUD
- `/api/tokens/[playbackId]` - Signed playback tokens
- `/api/time` - Server timestamp for client sync

### Synchronization Logic

The core sync mechanism lives in `src/lib/simulive.ts` and `src/components/SimulatedLivePlayer.tsx`:

1. Client fetches server time and calculates `serverTimeOffset`
2. Every `syncInterval` (default 5000ms), player checks drift against `driftTolerance` (default 2s)
3. If drift exceeds tolerance, player seeks to correct position
4. Visual states: countdown → live (with badge) → ended

### Authentication Flow

- `ADMIN_PASSWORD` env var enables admin protection
- Sessions stored in Redis (24hr TTL) with in-memory fallback
- Rate limiting: 5 login attempts per IP per 15 minutes
- Timing-safe password comparison prevents timing attacks

## Environment Variables

Required:
```
MUX_TOKEN_ID
MUX_TOKEN_SECRET
```

Optional (see `.env.example` for full list):
```
ADMIN_PASSWORD         # Protects /admin if set
DATABASE_URL           # PostgreSQL connection
REDIS_URL              # Redis connection
MUX_SIGNING_KEY        # For signed playback
MUX_PRIVATE_KEY        # Base64-encoded
```

## TypeScript Path Alias

`@/*` maps to `./src/*` - use `@/lib/db` instead of relative paths.

## Database Schema

Three models in `prisma/schema.prisma`:
- **Stream**: slug, title, scheduledStart, isActive, endedAt, loopCount (1-10), syncInterval, driftTolerance
- **PlaylistItem**: streamId, assetId, playbackId, playbackPolicy, duration, order
- **AuditLog**: event, severity, ipAddress, userAgent, details (JSON)

### Playlist & Looping
- Streams contain multiple PlaylistItems (videos) that play in sequence
- `loopCount` controls how many times the playlist repeats (max 10)
- Total broadcast duration = sum(item durations) × loopCount
- Player automatically switches videos and loops based on synchronized time

## Scaling Reference

See `docs/scaling-bottlenecks-plan.md` for 10k concurrent viewer optimization strategies.
