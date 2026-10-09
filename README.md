# Gym Management System (o2app)

Single-gym, single-location management: members, packages, memberships, billing with GST, enquiries, fingerprint attendance (adapter + simulator until hardware known), dashboard/reports, reminders, RBAC, PWA.

- Spec: `prompt.md` (amended Render-only Option A).
- Architecture: `docs/architecture.md`. Phased plan + audit: `docs/implementation-plan.md`.
- Stack: pnpm + Turborepo, Next.js (standalone on Render `o2app-web`), NestJS (`o2app-api`), Prisma + Neon Postgres, GH Actions.

## Phase 0 status

Docs only, no app code yet. See `docs/` (14 files). Next: Phase 1 scaffold (`pnpm init`, `apps/web`, `apps/api`, `prisma`, `render.yaml`, CI).

## Quick links

- `docs/requirements.md`, `docs/database-erd.md`, `docs/api.md`, `docs/roles-permissions.md`
- `docs/billing-rules.md`, `docs/membership-rules.md`, `docs/attendance-integration.md`
- `docs/deployment.md`, `docs/backup-restore.md`, `docs/security.md`, `docs/testing.md`, `docs/operations-runbook.md`
