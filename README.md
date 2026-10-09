# Gym Management System (o2app) — O2 Oxygen Fitness Studio

Single-gym, single-location management: members, packages, memberships, billing with GST, enquiries, fingerprint attendance (adapter + simulator until hardware known), dashboard/reports, reminders, RBAC, PWA.

- Spec: `prompt.md` (amended Render-only Option A).
- Architecture: `docs/architecture.md`. Phased plan + audit: `docs/implementation-plan.md`.
- Stack: pnpm + Turborepo, Next.js (standalone on Render `o2app-web`), NestJS (`o2app-api`), Prisma + Neon Postgres, GH Actions.

## Phase 0 status — DONE

Docs only. See `docs/` (14 files).

## Phase 1 status — DONE (foundation)

Monorepo scaffolded: `apps/web` (Next.js standalone), `apps/api` (NestJS + Prisma),
`packages/shared` (billing/dates/permissions + unit tests), `prisma/` (initial
`init_auth_rbac` migration), `render.yaml` (2 Render services), GH Actions
(pr-check + scheduler). Verified: format, typecheck, lint, tests, builds green;
`/api/v1/health/live|ready` (db: up) and web `/healthz` smoke-tested live.

## Local dev

Requires Node 22+ and pnpm 9 + local Postgres 16 (DB `gym`, role `gym/gym`).

```sh
cp -n .env.example .env
pnpm install
pnpm db:migrate        # applies prisma/migrations to local DB
pnpm dev               # web :3000 + api :4000 (via turbo)
# health:
curl localhost:4000/api/v1/health/ready && curl localhost:3000/healthz
# checks:
pnpm format:check && pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

## Phase 2 status — DONE (auth + RBAC + O2 branded shell)

Backend: Argon2id login, httpOnly cookie sessions (15-min access + 7-day rotating
refresh), double-submit CSRF, DB lockout (5 fails → 15 min) + rate limits, users /
roles / permissions APIs with `staff.manage` + `roles.manage` guards, audit logs,
`pnpm --filter @o2app/api seed` bootstrap (roles + owner, idempotent).

```sh
OWNER_EMAIL=owner@o2.fit OWNER_PASSWORD='ChangeMe123!x' pnpm --filter @o2app/api seed
```

Web: black/orange O2 Oxygen Fitness Studio theme, login page, sidebar + topbar app
shell with permission-filtered nav, dashboard stub, staff / roles-permissions /
profile (change password, sign out everywhere) pages. Auth tests: unit (argon2, JWT,
CSRF) + `RUN_AUTH_FLOW=1` integration (login, 403s, rotation, logout).

## Quick links

- `docs/requirements.md`, `docs/database-erd.md`, `docs/api.md`, `docs/roles-permissions.md`
- `docs/billing-rules.md`, `docs/membership-rules.md`, `docs/attendance-integration.md`
- `docs/deployment.md`, `docs/backup-restore.md`, `docs/security.md`, `docs/testing.md`, `docs/operations-runbook.md`
