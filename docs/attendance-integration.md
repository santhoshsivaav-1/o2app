# Attendance Integration (Phase 7 implemented — hardware still unknown)

Status: manufacturer/model/protocol unknown → adapter interface + simulator live;
local PC connector NOT built (deferred until hardware protocol/SDK is confirmed).

Status: manufacturer/model/protocol unknown → **adapter + simulator only**; local PC connector deferred until hardware confirmed.

## Implemented (Phase 7)

- `AttendanceDeviceAdapter` interface + `SimulatedAdapter` in `apps/api/src/attendance/adapter.ts`.
- Server-side HttpPush ingress: `POST /api/v1/devices/events:ingest` (per-device API key, rotatable/revocable, throttled, CSRF-exempt by design).
- Raw `attendance_events` (immutable, unique dedupe key, idempotent replay) → derived one-record-per-member-per-day `attendance_records` (earliest scan wins; repeats marked duplicate, raw kept).
- Explicit device↔member mapping + unmapped-user review queue (nothing silently dropped; mapping reprocesses pending scans).
- Manual check-in + audited corrections (`attendance.correct`), device health + sync-run history, CSV export.
- Attendance is recorded regardless of membership validity; validity is computed live and shown (front desk handles expiry conversations — documented choice, not a gap).

## Adapter interface (packages/shared + apps/api)

```ts
interface AttendanceDeviceAdapter {
  connect(): Promise<void>;
  getDeviceInfo(): Promise<{ model: string; firmware: string }>;
  fetchAttendanceEvents(cursor: string): Promise<RawDeviceEvent[]>;
  mapDeviceUser(deviceUserId: string): Promise<string | null>; // memberId
  acknowledgeEvents(eventIds: string[]): Promise<void>;
  healthCheck(): Promise<{ ok: boolean; lastSyncAt: string }>;
}
```

Implementations: `SimulatedAdapter` (dev/test, events flagged `source=simulated`, never shown as real) + `HttpPushAdapter` (prod ingest endpoint `POST /devices/events:ingest`, device API key bearer, rotatable). Future `SdkPollAdapter` plugs in without changing ingestion pipeline.

## Ingestion guarantees

- Store raw `attendance_events` immutable with `dedupeKey = deviceId + ':' + deviceEventId` (unique). Idempotent re-POST returns existing.
- Normalize `occurredAt` to UTC, keep raw payload + timezone meta.
- Derive `attendance_records`: check-in only; ignore repeats within `DUPLICATE_WINDOW_MIN` (default 5, per-device configurable); out-of-order/delayed accepted (recompute day bucket).
- Unmapped `deviceUserId` → `status=unmapped`, appears in review queue; never dropped.
- Sync log per batch in `device_sync_runs` (counts, errors, duration).
- Manual check-in (`attendance.correct` perm) + corrections (old/new diff in `audit_logs`).
- Browser/PWA never holds hardware connection.
