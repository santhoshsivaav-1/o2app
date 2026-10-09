# Gym Management System — Architecture (Phase 0)

Locked decisions: **pnpm + Turborepo monorepo, Render-only Option A (2 services), GST required, fingerprint device UNKNOWN → adapter + simulator.**

## System overview

```
Browser/PWA (Render o2app-web: Next.js standalone)
   │  https + httpOnly cookie + CSRF, TanStack Query → REST
   ▼
API (Render o2app-api: NestJS /api/v1, JWT guards, Swagger)
   │  Prisma ORM, transactions, PG job queue
   ▼
PostgreSQL (Neon free) — single DB, pooled + direct URLs
   ▲
GitHub Actions — CI + cron trigger → POST /api/v1/internal/jobs/run (JOBS_SECRET)
```

## Monorepo layout

```
o2app/
  apps/web/          # Next.js App Router, TS strict, Tailwind, shadcn/ui, RHF+Zod, TanStack Query, Recharts, PWA
  apps/api/          # NestJS modules, controllers (thin) → services, DTOs class-validator, guards
  packages/shared/   # types, Zod schemas, billing/GST math, membership date utils, permission constants, dedupe keys
  prisma/            # schema.prisma, migrations, seed (dev/test only)
  docs/              # this folder (§23, 14 docs)
  scripts/           # backup.sh, restore.sh, create-owner.ts, health-check.sh
  .github/workflows/ # pr-check.yml, deploy-render.yml, scheduler.yml
  render.yaml        # o2app-web + o2app-api blueprints
  pnpm-workspace.yaml, turbo.json
  Dockerfile         # OPTIONAL fallback: single-service collapse if free quota hit
```

## Key design decisions

1. **No static export.** Next runs as Node `standalone` server on Render `$PORT`. SSR/RSC/PWA kept intact.
2. **Thin controllers, fat services.** All money/date/attendance rules live in `apps/api` services + `packages/shared` pure functions (unit-tested). Frontend never touches Postgres.
3. **Money as Decimal(12,2).** Shared formula: `total = subtotal - discount + GST(gstPercent, exclusive by default, configurable)`; `outstanding = total - allocated + refunds`. No float math.
4. **Dates in UTC, display Asia/Kolkata.** Membership end-date inclusive (see `membership-rules.md`); all reports document which date they aggregate (invoice vs payment vs event time).
5. **Auth:** httpOnly `Secure; SameSite=None` cookie (cross-subdomain web→api on Render) + CSRF token + refresh rotation + `sessions` table revocation. No localStorage tokens. Argon2id hashing, login throttle, audit events.
6. **Jobs without Redis:** PG tables `reminder_jobs` + `system_job_runs`, claimed with `FOR UPDATE SKIP LOCKED`, retry w/ backoff, idempotent handlers. Cron via GitHub Actions (delay-tolerant, processes overdue windows).
7. **Attendance layering:** raw `attendance_events` (immutable, dedupeKey unique) → derived `attendance_records` (duplicate-scan window, default ignore <5min, configurable). Unmapped device users go to review queue, never silently dropped.
8. **Portability:** Render specifics isolated to `render.yaml` + env. Business logic has no provider imports → movable to paid/self-hosted later.
9. **Security:** NestJS PermissionsGuard on every protected route (403/401 correct), FE nav filtering is cosmetic only. Audit logs for finance/admin/membership/attendance corrections. No secrets in `NEXT_PUBLIC_*` except API base URL.

## Environments

| Env          | Web                             | API                                   | DB                                |
| ------------ | ------------------------------- | ------------------------------------- | --------------------------------- |
| local        | `pnpm --filter web dev` (:3000) | `pnpm --filter api start:dev` (:4000) | Docker Postgres (:5432)           |
| staging/prod | `o2app-web.onrender.com`        | `o2app-api.onrender.com`              | Neon (pooled app, direct migrate) |

## Risks carried into Phase 1

Render free sleep (~15min idle, 30-60s cold start), Neon free quotas, GH cron delays — all handled by overdue-safe jobs + client retries, documented as pilot-only (see `implementation-plan.md`).
