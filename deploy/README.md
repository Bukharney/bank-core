# Production Deployment Guide: Linux ARM with Rootless Podman

This document covers everything required to deploy the **Bank Core** stack onto a Linux ARM host (Raspberry Pi 4/5, Oracle Cloud Ampere A1, AWS Graviton, Apple Silicon VMs) using **Rootless Podman** and **GitHub Actions CI/CD**.

---

## 1. Architecture Overview

```
[ Clients / Web Browsers ]
            │
            ▼
[ Cloudflare Tunnel Container ] (Existing)
            │  (routes to localhost:3000)
            ▼
[ Podman Network: bank-net ]
 ├── Next.js Frontend (:3000) ───[ Proxies /api/* to http://backend:8080 ]
 │                            └───[ Proxies /api/atm/* to http://atm:808{1,2,3} ]
 ├── ATM Simulator (:8081-8083)───[ Verifies/Confirms ]──► Go Core Engine (:8080)
 ├── Go Core Engine (:8080)   ───[ Dispense Callbacks ]──► ATM Simulator (:8081-8083)
 │                            ├───[ Reads/Writes ]──► PostgreSQL 14 (pgdata volume)
 │                            └───[ Cache/Outbox ]──► Redis 7 (redisdata volume)
```

- **Backend API**: Static Go binary running on minimal Alpine Linux as a non-root user (`appuser:10001`), with SQL migrations compiled directly into the binary via `embed.FS`.
- **ATM Simulator**: Dedicated container running 3 virtual ATM vault instances (`:8081`, `:8082`, `:8083`) under non-root `atmuser:10002`, isolated to `bank-net` without exposing host ports.
- **Frontend**: Next.js 14 in standalone mode running on Node 20 Alpine (`nextjs:1001`), serving responsive UI and proxying API calls to `http://backend:8080` and ATM endpoints.
- **Datastores**: Official ARM64 `postgres:14-alpine` and `redis:7-alpine` with healthchecks and Podman named volumes (`pgdata`, `redisdata`).

---

## 2. Linux ARM Host Prerequisites

### 2.1 Install Podman and Podman Compose

On Debian / Ubuntu ARM64:
```bash
sudo apt update
sudo apt install -y podman podman-compose curl
```

On Fedora / RHEL / CentOS Stream ARM64:
```bash
sudo dnf install -y podman podman-compose curl
```

### 2.2 Configure Rootless Podman Persistence

To ensure rootless containers continue running after your SSH session disconnects or the user logs out:
```bash
# Enable lingering for your current non-root user
loginctl enable-linger $USER
```

Verify your subuid and subgid mappings exist:
```bash
grep $USER /etc/subuid
grep $USER /etc/subgid
```
*(Standard modern Linux distributions automatically generate these upon user creation).*

---

## 3. GitHub Actions CI/CD Pipeline

The workflow in `.github/workflows/ci-cd.yml` automates testing and container publication:

1. **Backend CI**: Executes `go vet` and `go test -v -race ./...`.
2. **Frontend CI**: Executes `pnpm install`, `pnpm run lint`, and `pnpm run build` (standalone).
3. **Multi-Platform Build & Push**:
   - Compiles images for both `linux/amd64` and `linux/arm64` using Docker Buildx and QEMU.
   - Pushes to GitHub Container Registry (`ghcr.io`):
     - `ghcr.io/<your-username>/bank-core-backend:latest`
     - `ghcr.io/<your-username>/bank-core-frontend:latest`
   - Automatically triggered on every push to `main` or manually via **Actions > CI/CD Pipeline > Run workflow**.

### GHCR Package Permissions
If your repository is **Private**, container images published to GHCR default to private. On your Linux ARM host, run:
```bash
./deploy.sh login
```
Provide your GitHub username and a Personal Access Token (classic or fine-grained) with `read:packages` permission.

*(If you set the package visibility to **Public** in GitHub Package settings, no login is needed to pull).*

---

## 4. Deploying to the Linux ARM Host

### Step 1: Copy Deployment Files to the Server

You only need the following three files on your server (or you can clone the repository):
- `docker-compose.prod.yml`
- `deploy.sh`
- `.env.prod.example`

Make `deploy.sh` executable:
```bash
chmod +x deploy.sh
```

### Step 2: Configure Production Environment

Create your production environment file:
```bash
cp .env.prod.example .env.prod
nano .env.prod
```

Configure strong secrets:
```bash
# Generate high-entropy secrets using openssl:
openssl rand -hex 32  # Use for JWT_ACCESS_SECRET
openssl rand -hex 32  # Use for JWT_REFRESH_SECRET
openssl rand -base64 24 # Use for POSTGRES_PASSWORD
openssl rand -base64 24 # Use for REDIS_PASSWORD
```

Ensure `BACKEND_IMAGE` and `FRONTEND_IMAGE` point to your repository namespace:
```env
BACKEND_IMAGE=ghcr.io/<your-github-username>/bank-core-backend:latest
FRONTEND_IMAGE=ghcr.io/<your-github-username>/bank-core-frontend:latest
```

### Step 3: Launch Containers

Pull images and start the stack:
```bash
./deploy.sh pull
./deploy.sh up
```

### Step 4: Verify Deployment Status

Check container health:
```bash
./deploy.sh status
```

Check logs:
```bash
# View logs from all services
./deploy.sh logs

# View backend logs specifically
./deploy.sh logs backend

# View frontend logs specifically
./deploy.sh logs frontend
```

---

## 5. Cloudflare Tunnel Integration

Since you have Cloudflare Tunnel running in another container on the same host:

In your Cloudflare Zero Trust Dashboard (or `config.yml`):
- **Service**: `HTTP`
- **URL**: `http://localhost:3000` (or `http://127.0.0.1:3000`)
- **Public Hostname**: e.g., `bank.yourdomain.com`

All user requests hitting `https://bank.yourdomain.com` will hit the Next.js frontend, and all `/api/*` banking requests will be transparently reverse-proxied internally to the Go backend (`bank_backend:8080`).

---

## 6. Maintenance & Updates

When new code is pushed to `main`, GitHub Actions automatically builds and pushes updated ARM64 images to GHCR.

To deploy the new version on your server, simply run:
```bash
./deploy.sh pull
./deploy.sh up
```

To stop the services:
```bash
./deploy.sh down
```

To restart the stack:
```bash
./deploy.sh restart
```
