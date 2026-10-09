# Gym Management System (o2app)

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

## Quick links

- `docs/requirements.md`, `docs/database-erd.md`, `docs/api.md`, `docs/roles-permissions.md`
- `docs/billing-rules.md`, `docs/membership-rules.md`, `docs/attendance-integration.md`
- `docs/deployment.md`, `docs/backup-restore.md`, `docs/security.md`, `docs/testing.md`, `docs/operations-runbook.md`
