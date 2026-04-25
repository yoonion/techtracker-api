# Backend Deployment (EC2 + RDS + Docker Compose + GHCR)

## 1) One-time EC2 setup

```bash
# Amazon Linux 2023
sudo dnf update -y
sudo dnf install -y docker git
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user

# reconnect SSH after adding docker group
```

Install Docker Compose plugin:

```bash
DOCKER_CONFIG=${DOCKER_CONFIG:-$HOME/.docker}
mkdir -p "$DOCKER_CONFIG/cli-plugins"
curl -SL https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-x86_64 \
  -o "$DOCKER_CONFIG/cli-plugins/docker-compose"
chmod +x "$DOCKER_CONFIG/cli-plugins/docker-compose"
docker compose version
```

## 2) Prepare app directory on EC2

```bash
mkdir -p ~/techtracker-api
cd ~/techtracker-api
```

Copy these files from repository to EC2:

- `docker-compose.yml`
- `deploy/nginx/default.conf`
- `.env.example`

## 3) Create `.env.prod` from `.env.example`

On EC2:

```bash
cp .env.example .env.prod
```

Then edit `~/techtracker-api/.env.prod` for production values:

```env
PORT=4000
FRONTEND_BASE_URL=https://your-frontend-domain

DB_HOST=<RDS endpoint>
DB_PORT=3306
DB_USERNAME=<rds user>
DB_PASSWORD=<rds password>
DB_NAME=<db name>
DB_SYNC=false
DB_TIMEZONE=Z

JWT_SECRET=<strong random string>

# optional
COLLECTOR_INTERVAL_MS=300000
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI=
DISCORD_STATE_SECRET=
DISCORD_BOT_TOKEN=
```

## 4) GitHub secrets

Add repository secrets:

- `EC2_HOST`: EC2 public IP or domain
- `EC2_USER`: usually `ec2-user`
- `EC2_SSH_KEY`: private key (PEM content)
- `GHCR_PAT`: Personal Access Token with `read:packages`

## 5) Deploy behavior

Current workflow (`.github/workflows/deploy.yml`) does:

1. Build Docker image and push to GHCR
2. SSH into EC2
3. `docker compose pull api`
4. `docker compose up -d --remove-orphans api`

So first production startup on EC2 can be:

```bash
cd ~/techtracker-api
docker compose pull api
docker compose up -d api
```

If you want Nginx reverse proxy, run with profile:

```bash
cd ~/techtracker-api
docker compose --profile proxy up -d
```

## 6) Verify

```bash
docker ps
docker logs -f techtracker-api
curl http://127.0.0.1:4000
```

If using Nginx profile:

```bash
docker logs -f techtracker-nginx
curl http://127.0.0.1
```

## 7) Security group checklist

- API only mode: open inbound `4000` temporarily (test), then close
- Nginx mode: open inbound `80` (and later `443` after TLS)
- RDS security group: allow inbound `3306` from EC2 security group only
