# Testing Strategy (Phase 0)

- Unit (Jest, `packages/shared` + services): GST math, end-date calc, outstanding derivation, dedupe keys, permission matrix, duplicate windows. Run: `pnpm --filter shared test`.
- API integration (Jest+Supertest, ephemeral Postgres): auth (valid/invalid/disabled/revoked/403), member dedupe+pagination, membership renew idempotency, billing full/partial/multi/refund/retry/concurrent (2 parallel pays → exactly 1 allocation set), ingest duplicate/delayed/unmapped, enquiry convert-once, report reconciliation + timezone edges.
- E2E (Playwright, against staging Render or local): login→member→membership→pay→receipt, renew, convert enquiry, manual attendance + correction, expiry reminder appears in-app.
- Gates: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` per PR (`pr-check.yml`); migrations applied to scratch DB in CI; secrets-scan (gitleaks) on PR.
- Data: factories with realistic Indian names/phones/packages; never prod dumps in tests.
