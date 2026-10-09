# Gym Management System (o2app) — O2 Oxygen Fitness Studio

Design: professional light theme (white surfaces, stone text, orange brand accents),
grouped sidebar navigation, split-screen login. Shared classes in
`apps/web/app/globals.css` (card, table-card, input, buttons, badges, alerts) —
use them instead of inventing new styles per page.

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

## Phase 3 status — DONE (members + packages)

Backend: gender categories (seeded Male/Female/Other, `settings.manage` to extend),
member CRUD with auto `O2-YYYY-####` codes (transactional sequence), duplicate-mobile
409 + explicit audited override, server search/filter/sort/pagination, CSV export
(`data.export`), archive/restore (no hard deletes), follow-up notes, package CRUD +
deactivate-preserves-history (`settings.manage` writes, open read). Migration
`phase3_members_packages`.

Web: member directory (search/filters/pagination/export), RHF + shared-Zod
registration with duplicate-confirmation flow, member profile (edit, notes,
archive/restore), packages manager, honest Coming-Soon stubs for Phases 4–8 so no
nav 404s. Tests: shared 11/11, api 7/7 with `RUN_AUTH_FLOW=1`.

## Phase 4 status — DONE (membership lifecycle + invoices)

Backend: sale / renew / extend / suspend / resume / cancel with transactional
membership + `INV-YYYY-####` invoice creation, idempotent retries, discount caps,
inactive-package rules, gym-timezone validity (`scheduled/active/expired/
suspended/cancelled`), `by-member/current` endpoint for attendance + UI.
Migration `phase4_memberships_invoices`. Invoices stay `unpaid` until Phase 5
records payments.

Web: membership directory (validity/package/expiry filters), sale wizard with live
GST total preview, detail page (invoice box, manage actions, renewal timeline),
member profile shows real membership history. Tests: shared 15/15, api 8/8 with
`RUN_AUTH_FLOW=1`. Rules locked in `docs/membership-rules.md`.

## Phase 5 status — DONE (billing & payments)

Backend: payment recording with allocations (same-member, ≤ outstanding checks),
overpayment → member credit, race-safe idempotency, refunds as separate audited
events (`payments.refund`), derived invoice statuses, collections / outstanding /
refund reports + CSV exports. Migration `phase5_payments`.

Web: billing hub (collect with open-invoice allocation, payments, invoices,
financial reports), invoice detail, printable receipts with manual-verification
notice + refund action, member profile shows real invoices & payment history.
Tests: shared 16/16, api 9/9 with `RUN_AUTH_FLOW=1`. Rules in
`docs/billing-rules.md`.

## Phase 6 status — DONE (enquiries & follow-ups)

Backend: lead CRUD with `ENQ-YYYY-####` numbers, assignment, statuses (leads become
Converted only through the explicit convert action), follow-up activities with
next-action tracking, overdue/upcoming/all queue, conversion that reuses member
registration (duplicate protection included) and preserves enquiry history,
lead volume/conversion/source report. Migration `phase6_enquiries`.

Web: enquiry pipeline (filters incl. overdue), new-lead form, lead detail
(edit/assign/status, follow-up timeline, convert wizard), follow-ups work queue.
Tests: shared 17/17, api 10/10 with `RUN_AUTH_FLOW=1`.

## Quick links

- `docs/requirements.md`, `docs/database-erd.md`, `docs/api.md`, `docs/roles-permissions.md`
- `docs/billing-rules.md`, `docs/membership-rules.md`, `docs/attendance-integration.md`
- `docs/deployment.md`, `docs/backup-restore.md`, `docs/security.md`, `docs/testing.md`, `docs/operations-runbook.md`
