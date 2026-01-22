# WatchParty - Quick Start Guide

## 🚀 Deploy on Unraid (5 Minutes)

### Step 1: Upload Files

Upload entire project to:
```
/mnt/user/appdata/watchparty/
```

### Step 2: Configure

Create `.env` file:

```bash
cd /mnt/user/appdata/watchparty
nano .env
```

Add:
```env
PORT=3080
POSTGRES_PASSWORD=change_me_now
ADMIN_PASSWORD=your_admin_password
SECURE_COOKIES=false
```

### Step 3: Deploy

```bash
docker compose up -d
```

### Step 4: Access

Open browser:
```
http://YOUR-UNRAID-IP:3080
```

Create room:
```
http://YOUR-UNRAID-IP:3080/admin/(protected)/create-room
```

---

## 📋 Common Commands

### View Status
```bash
docker compose ps
```

### View Logs
```bash
docker compose logs -f
```

### Restart
```bash
docker compose restart
```

### Stop
```bash
docker compose down
```

### Update
```bash
docker compose build --no-cache
docker compose up -d
```

### Backup Database
```bash
docker compose exec postgres pg_dump -U watchparty watchparty > backup.sql
```

### Restore Database
```bash
cat backup.sql | docker compose exec -T postgres psql -U watchparty watchparty
```

---

## 🔧 Troubleshooting

### Containers won't start
```bash
# Check what's wrong
docker compose logs

# Common fix: port conflict
# Change PORT in .env to different number
```

### Chat/sync not working
- Check nginx logs: `docker compose logs nginx`
- Verify WebSocket in reverse proxy settings
- Enable "WebSocket Support" in Nginx Proxy Manager

### Can't login to admin
- Set `ADMIN_PASSWORD` in `.env`
- Restart: `docker compose restart watchparty`

### High memory usage
```bash
# Clear Redis cache
docker compose exec redis redis-cli FLUSHALL
docker compose restart
```

---

## 🌐 Reverse Proxy (Nginx Proxy Manager)

1. Add Proxy Host:
   - Domain: `watchparty.yourdomain.com`
   - Forward to: `YOUR-UNRAID-IP:3080`
   - **✅ Enable WebSocket Support** (CRITICAL!)
   - Enable SSL

2. Update `.env`:
   ```env
   SECURE_COOKIES=true
   ```

3. Restart:
   ```bash
   docker compose restart watchparty
   ```

---

## 📦 Stack Components

| Service | Container Name | Purpose |
|---------|---------------|---------|
| nginx | watchparty-nginx | Reverse proxy + WebSocket |
| watchparty | watchparty-app | Main application |
| postgres | watchparty-postgres | Database |
| redis | watchparty-redis | Cache + Socket.io |

**External Port**: 3080 (only nginx)
**Internal Network**: watchparty-network
**Data Volumes**:
- `watchparty-postgres-data`
- `watchparty-redis-data`

---

## 🎯 Feature Checklist

After deployment, test:

- [ ] Homepage loads at `http://IP:3080`
- [ ] Create room at `/admin/(protected)/create-room`
- [ ] YouTube video URL works
- [ ] Plex authentication works (if using Plex)
- [ ] Chat sends messages in real-time
- [ ] Play/pause syncs across browsers
- [ ] Co-host permissions work
- [ ] Public rooms show on homepage

---

## ⚙️ Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| PORT | No | 3080 | External port |
| POSTGRES_PASSWORD | **Yes** | watchparty | Database password |
| ADMIN_PASSWORD | Recommended | (none) | Admin panel password |
| SECURE_COOKIES | No | false | Enable for HTTPS |
| NEXT_PUBLIC_PLEX_CLIENT_ID | No | watchparty-app | Plex OAuth ID |

---

## 📊 Resource Usage

**Typical Usage:**
- CPU: 2-5% idle, 10-20% during active use
- RAM: 1-2GB total (all containers)
- Storage: 500MB-1GB

**Limits:**
- App: 4GB max
- Nginx: 256MB max
- Redis: 512MB data max
- PostgreSQL: Unlimited (typically 100-200MB)

---

## 🔒 Security Checklist

- [ ] Changed `POSTGRES_PASSWORD` from default
- [ ] Set `ADMIN_PASSWORD` to protect room creation
- [ ] Using reverse proxy with SSL certificate
- [ ] Set `SECURE_COOKIES=true` when using HTTPS
- [ ] Firewall blocks direct port 3080 from internet
- [ ] Using Cloudflare proxy (optional, hides IP)

---

## 🆘 Need Help?

1. **Check logs first**: `docker compose logs -f`
2. **Read full guide**: `UNRAID_DEPLOYMENT.md`
3. **Check documentation**: `TRANSFORMATION_COMPLETE.md`
4. **Verify all containers healthy**: `docker compose ps`

---

**Ready to host watch parties!** 🎬🍿

Quick test: Open two browser windows to the same room and press play in one - the other should sync automatically!
