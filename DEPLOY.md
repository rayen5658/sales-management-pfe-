# Deploying GestionVentes

This runs the whole app (database, backend, frontend) as three Docker containers with
automatic HTTPS. Once it's running, it stays running — survives reboots, restarts
itself if a container crashes, and needs zero manual `npm run dev` ever again.

## What you need first (not something I can do for you)

1. **A VPS** — any provider works (DigitalOcean, Hetzner, Contabo, OVH). A cheap
   $5–10/mo plan (1-2 vCPU, 2-4GB RAM) is enough for this app's scale. Pick a plan
   with **Docker pre-installed**, or install Docker yourself after provisioning
   (`curl -fsSL https://get.docker.com | sh` on Ubuntu/Debian).
2. **A domain name**, with an **A record** pointing its hostname at your VPS's
   public IP address (set this in your domain registrar's DNS settings). This is
   what lets Caddy get you free, automatic HTTPS — it won't work pointed at a bare
   IP address.

## One-time setup on the server

```bash
# 1. Get the code onto the server (push this repo to GitHub/GitLab first, then:)
git clone <your-repo-url> gestionventes
cd gestionventes

# 2. Copy your real backend/.env from your local machine onto the server
#    (scp it over, or recreate it) — it already has your JWT_SECRET, SMTP
#    credentials, ENCRYPTION_KEY, etc. Do NOT commit this file to git.

# 3. Create the root .env (separate from backend/.env — see .env.example)
cp .env.example .env
nano .env   # set DB_USER/DB_PASSWORD/DB_NAME to match backend/.env exactly,
            # and set DOMAIN=yourdomain.com

# 4. Also update backend/.env for production:
#    FRONTEND_URL=https://yourdomain.com
#    BACKEND_URL=https://yourdomain.com
#    (and KONNECT_BASE_URL, once Konnect approves your production account)

# 5. Build and start everything, in the background, permanently
docker compose up -d --build
```

That's it — visit `https://yourdomain.com` after a minute or two (Caddy needs a
moment to provision the certificate the first time).

## Running database migrations on the server

Your `backend/migrations/*.sql` files aren't run automatically. After the first
deploy (and after pulling any future update that adds a new migration), run:

```bash
docker compose exec db psql -U <DB_USER> -d <DB_NAME> -f /dev/stdin < backend/migrations/0XX_whatever.sql
```

(Run each new migration file once, in order — same as you did locally this session.)

## Day-to-day operations

```bash
docker compose ps                 # see what's running
docker compose logs -f backend    # tail backend logs live
docker compose logs -f web        # tail Caddy/frontend logs
docker compose down               # stop everything
docker compose up -d --build      # rebuild + restart after you push code changes
```

## Updating the app after this point

```bash
git pull
docker compose up -d --build      # rebuilds only what changed, restarts with zero manual steps
```

## Scaling notes

`backend/db.js` now caps the database connection pool at 25 (set `DB_POOL_MAX` in
`backend/.env` to change it). If you outgrow a single VPS, the next real step is
running the `backend` service as multiple replicas behind the same Caddy — ask when
you're actually there, it's premature before you have real traffic to justify it.
