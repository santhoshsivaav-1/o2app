# Attendance Integration (Phase 0 — device UNKNOWN)

Status: manufacturer/model/protocol unknown → **adapter + simulator only** in Phases 1–8; local PC connector deferred until hardware confirmed.

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
