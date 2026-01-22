# WatchParty - Unraid Deployment Guide

Complete guide for deploying WatchParty as a Docker Compose stack on Unraid.

## Overview

This stack includes:
- **WatchParty App**: Next.js application with Socket.io (4 clustered workers)
- **Nginx**: Reverse proxy with WebSocket support
- **PostgreSQL 16**: Database for rooms and participants
- **Redis 7**: Cache and Socket.io pub/sub adapter

**Total Resources:**
- Memory: ~2-4GB (4GB limit, 512MB minimum)
- Storage: ~500MB for app + database volumes
- Port: 3080 (configurable)

## Quick Start

### 1. Prepare Your Files

On your Unraid server, create a directory for WatchParty:

```bash
mkdir -p /mnt/user/appdata/watchparty
cd /mnt/user/appdata/watchparty
```

Upload these files to this directory:
- `docker-compose.yml`
- `nginx.conf`
- `Dockerfile`
- All application source code (entire project)

### 2. Configure Environment

Create a `.env` file:

```bash
cp .env.production .env
nano .env
```

**Minimum required configuration:**

```env
# External port (change if 3080 is already in use)
PORT=3080

# IMPORTANT: Change this password!
POSTGRES_PASSWORD=your_secure_password_here

# Recommended: Set an admin password to protect room creation
ADMIN_PASSWORD=your_admin_password

# If using HTTPS reverse proxy (Nginx Proxy Manager, Cloudflare Tunnel)
SECURE_COOKIES=true
```

### 3. Deploy the Stack

#### Option A: Docker Compose (Recommended)

Install Docker Compose plugin if not already installed:

```bash
# Check if docker-compose is available
docker compose version

# If not available, install Compose plugin via Unraid CA
# Search for "Docker Compose Manager" in Community Applications
```

Start the stack:

```bash
cd /mnt/user/appdata/watchparty
docker compose up -d
```

#### Option B: Unraid Docker UI (Manual)

If you prefer using Unraid's Docker UI, you'll need to create 4 separate containers. See "Manual Container Setup" section below.

### 4. Verify Deployment

Check container status:

```bash
docker compose ps
```

All containers should show "healthy" status after ~30 seconds.

Check logs:

```bash
# App logs
docker compose logs -f watchparty

# All services
docker compose logs -f
```

### 5. Access WatchParty

Open your browser:

```
http://YOUR-UNRAID-IP:3080
```

Create your first room:

```
http://YOUR-UNRAID-IP:3080/admin/(protected)/create-room
```

## Volume Mappings

WatchParty uses **named Docker volumes** for data persistence:

| Volume Name | Purpose | Typical Size |
|-------------|---------|--------------|
| `watchparty-postgres-data` | PostgreSQL database | 100-500MB |
| `watchparty-redis-data` | Redis persistence | 10-50MB |

### Backup Your Data

To backup your WatchParty data:

```bash
# Backup PostgreSQL
docker compose exec postgres pg_dump -U watchparty watchparty > backup.sql

# Restore from backup
cat backup.sql | docker compose exec -T postgres psql -U watchparty watchparty
```

### Migrate Volumes to Unraid Array

If you want volumes on the Unraid array instead of Docker image:

Edit `docker-compose.yml` volumes section:

```yaml
volumes:
  watchparty-postgres-data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /mnt/user/appdata/watchparty/data/postgres
  watchparty-redis-data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /mnt/user/appdata/watchparty/data/redis
```

Create directories first:

```bash
mkdir -p /mnt/user/appdata/watchparty/data/{postgres,redis}
chown -R 999:999 /mnt/user/appdata/watchparty/data/postgres  # Postgres UID
chown -R 999:999 /mnt/user/appdata/watchparty/data/redis     # Redis UID
```

## Port Configuration

Default port: **3080**

To change the port, edit `.env`:

```env
PORT=8080  # Or any available port
```

Then restart:

```bash
docker compose down
docker compose up -d
```

## Reverse Proxy Setup

### Using Nginx Proxy Manager

1. Add a new Proxy Host:
   - **Domain Names**: `watchparty.yourdomain.com`
   - **Scheme**: `http`
   - **Forward Hostname**: `YOUR-UNRAID-IP`
   - **Forward Port**: `3080`
   - **Websockets Support**: ✅ **Enable this!** (Critical for Socket.io)
   - **SSL**: Enable with Let's Encrypt

2. Update `.env`:
   ```env
   SECURE_COOKIES=true
   ```

3. Restart the stack:
   ```bash
   docker compose restart watchparty
   ```

### Using Cloudflare Tunnel

1. Create a tunnel pointing to `http://YOUR-UNRAID-IP:3080`
2. Ensure WebSocket support is enabled (default in Cloudflare)
3. Update `.env`:
   ```env
   SECURE_COOKIES=true
   ```

### Using Traefik

Add labels to `nginx` service in `docker-compose.yml`:

```yaml
nginx:
  labels:
    - "traefik.enable=true"
    - "traefik.http.routers.watchparty.rule=Host(`watchparty.yourdomain.com`)"
    - "traefik.http.routers.watchparty.entrypoints=websecure"
    - "traefik.http.services.watchparty.loadbalancer.server.port=80"
```

## Resource Management

### Memory Limits

Default limits in `docker-compose.yml`:

- **watchparty**: 4GB max, 512MB min
- **nginx**: 256MB max, 64MB min
- **postgres**: No limit (uses ~100-200MB)
- **redis**: No limit (512MB max data via config)

Adjust if needed in `docker-compose.yml`:

```yaml
watchparty:
  deploy:
    resources:
      limits:
        memory: 2G  # Reduce for low-memory systems
      reservations:
        memory: 256M
```

### CPU Priority

To give WatchParty higher priority on Unraid:

```yaml
watchparty:
  deploy:
    resources:
      reservations:
        cpus: '1.0'  # Reserve 1 CPU core
```

## Updates

### Update WatchParty

```bash
cd /mnt/user/appdata/watchparty

# Pull latest code (if using git)
git pull

# Rebuild and restart
docker compose build --no-cache
docker compose up -d
```

### Update Dependencies Only

```bash
docker compose pull postgres redis nginx
docker compose up -d
```

## Troubleshooting

### Containers Won't Start

Check logs:

```bash
docker compose logs
```

Common issues:
- **Port 3080 in use**: Change `PORT` in `.env`
- **Out of memory**: Reduce memory limits
- **Database connection failed**: Check `POSTGRES_PASSWORD` matches in `.env`

### WebSocket Connections Failing

Symptoms: Chat doesn't work, playback doesn't sync

1. **Check nginx logs**:
   ```bash
   docker compose logs nginx
   ```

2. **Verify WebSocket upgrade**:
   ```bash
   curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
     http://YOUR-UNRAID-IP:3080/socket.io/
   ```

   Should return `101 Switching Protocols`

3. **Check reverse proxy**: Ensure WebSocket support is enabled

### Database Migration Issues

If you see Prisma errors on startup:

```bash
# Manually run migrations
docker compose exec watchparty npx prisma db push --skip-generate

# Or reset database (WARNING: deletes all data)
docker compose exec watchparty npx prisma db push --force-reset
```

### High Memory Usage

Redis cache can grow large. To clear:

```bash
docker compose exec redis redis-cli FLUSHALL
docker compose restart watchparty
```

### Can't Access Admin Panel

1. **Set admin password** in `.env`:
   ```env
   ADMIN_PASSWORD=mysecretpassword
   ```

2. **Restart**:
   ```bash
   docker compose restart watchparty
   ```

3. **Access**: Navigate to `/admin/(protected)/create-room` and login

## Manual Container Setup (Unraid Docker UI)

If you can't use Docker Compose, create 4 containers manually:

### 1. PostgreSQL

- **Repository**: `postgres:16-alpine`
- **Network Type**: Custom `watchparty-network` (create bridge network first)
- **Port**: None needed
- **Variables**:
  - `POSTGRES_USER=watchparty`
  - `POSTGRES_PASSWORD=your_password`
  - `POSTGRES_DB=watchparty`
- **Path**: `/var/lib/postgresql/data` → `/mnt/user/appdata/watchparty/postgres`

### 2. Redis

- **Repository**: `redis:7-alpine`
- **Network Type**: Custom `watchparty-network`
- **Port**: None needed
- **Extra Parameters**: `redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru`
- **Path**: `/data` → `/mnt/user/appdata/watchparty/redis`

### 3. WatchParty App

- **Repository**: Build from local Dockerfile (complex, not recommended)
- **Network Type**: Custom `watchparty-network`
- **Port**: None needed
- **Variables**: All environment variables from `docker-compose.yml`
- **Depends On**: postgres, redis (start after them)

### 4. Nginx

- **Repository**: `nginx:alpine`
- **Network Type**: Custom `watchparty-network`
- **Port**: `3080:80`
- **Path**: `/etc/nginx/nginx.conf` → `/mnt/user/appdata/watchparty/nginx.conf` (read-only)
- **Depends On**: watchparty

**Note**: Manual setup is complex. Docker Compose is strongly recommended.

## Maintenance

### View Active Rooms

```bash
docker compose exec postgres psql -U watchparty -d watchparty \
  -c "SELECT slug, name, \"isPublic\", \"isPersistent\" FROM \"Room\";"
```

### Clear All Chat History

```bash
docker compose exec redis redis-cli --scan --pattern "chat:*" | \
  xargs docker compose exec redis redis-cli DEL
```

### View Logs

```bash
# Live logs
docker compose logs -f

# Last 100 lines
docker compose logs --tail=100

# Specific service
docker compose logs -f watchparty
```

### Restart Services

```bash
# Restart all
docker compose restart

# Restart specific service
docker compose restart watchparty
```

## Uninstall

To completely remove WatchParty:

```bash
cd /mnt/user/appdata/watchparty

# Stop and remove containers
docker compose down

# Remove volumes (WARNING: deletes all data!)
docker volume rm watchparty-postgres-data watchparty-redis-data

# Remove files
cd ..
rm -rf watchparty
```

## Performance Tips

1. **Use SSD for Docker image**: Unraid Settings → Docker → Docker vDisk location
2. **Increase Docker vDisk size**: If running many containers (default 20GB may be too small)
3. **Enable CPU pinning**: Pin containers to specific cores for better performance
4. **Use host network** (not recommended): Removes network overhead but exposes all ports

## Security Recommendations

1. **Change default passwords**: Set strong `POSTGRES_PASSWORD` and `ADMIN_PASSWORD`
2. **Use reverse proxy with SSL**: Don't expose port 3080 directly to internet
3. **Enable Cloudflare proxy**: Hides your Unraid IP address
4. **Set SECURE_COOKIES=true**: When using HTTPS
5. **Regular backups**: Backup PostgreSQL database regularly
6. **Update regularly**: Pull latest WatchParty updates monthly

## Support

- **Documentation**: See `TRANSFORMATION_COMPLETE.md`
- **Logs**: Always check `docker compose logs` first
- **Unraid Forums**: Post in Docker Engine section
- **GitHub Issues**: Report bugs in project repository

---

**Enjoy your self-hosted watch parties on Unraid!** 🎬🍿
