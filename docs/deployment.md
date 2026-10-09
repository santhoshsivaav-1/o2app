# Deployment — Render-only Option A (Phase 0)

Blueprint `render.yaml`: two free web services + Neon Postgres (external).

```yaml
services:
  - type: web, name: o2app-api, runtime: node, rootDir: apps/api
    buildCommand: pnpm install && pnpm build && prisma migrate deploy
    startCommand: node dist/main.js
    healthCheckPath: /api/v1/health/ready
    envVars: [DATABASE_URL, DIRECT_URL, JWT_*, SESSION_SECRET, CSRF_SECRET, JOBS_SECRET, DEVICE_API_KEYS, WEB_ORIGIN, GYM_TIMEZONE, GST_DEFAULT_PCT]
  - type: web, name: o2app-web, runtime: node, rootDir: apps/web
    buildCommand: pnpm install && pnpm build
    startCommand: node server.js  # next standalone
    healthCheckPath: /healthz
    envVars: [NEXT_PUBLIC_API_URL=https://o2app-api.onrender.com/api/v1]
```

- Node 22 LTS (pin; local Node 26 works but CI pins 22 for Render compat).
- CORS: api allows exactly `WEB_ORIGIN`; cookies `Secure; SameSite=None`; CSRF double-submit.
- `pr-check.yml`: install/lint/typecheck/jest/build. `deploy-render.yml`: migrate-review → deploy api → smoke → deploy web. `scheduler.yml`: cron every 30min → curl internal jobs endpoint with `JOBS_SECRET` (tolerates Render sleep/delay).
- Fallback: `Dockerfile` single-service (web+api) if free-service quota hit — no logic change.
- Limits: sleep ~15min idle, cold start 30-60s, Neon free caps — pilot-only, no always-on SLA.
