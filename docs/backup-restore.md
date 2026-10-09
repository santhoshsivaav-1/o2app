# Backup & Restore (Phase 0)

- Backup: `scripts/backup.sh` → `pg_dump --format=custom $DIRECT_URL > backups/o2app-$(date +%F).dump` (Neon branch/pITR where available). Store off-Render (gym-owned drive/S3-compatible), encrypt at rest (age/gpg), 30-day retention pilot.
- Restore: `scripts/restore.sh <dump> <target-url>` → `pg_restore --clean --if-exists` into EMPTY staging DB only; prod restore requires explicit owner approval + pre-restore backup.
- Verify: `scripts/verify-restore.sh` counts members/memberships/invoices/payments/attendance_events + reconciles `sum(payments)==sum(allocations)` + spot-checks dashboard KPIs.
- Never use GH Actions logs/artifacts as backup storage. Monthly restore drill on Neon branch. Post-restore checklist in `operations-runbook.md`.
- Free-plan note: Neon free may limit PITR/retention — manual dump before every migration touching finance/attendance tables.
