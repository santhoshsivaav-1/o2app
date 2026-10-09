/**
 * Provider-independent fingerprint-device contract (§12).
 *
 * The gym's hardware model is still UNKNOWN, so no vendor SDK is wired in.
 * - `SimulatedAdapter` below feeds clearly-flagged fake events through the SAME
 *   ingestion pipeline for dev/test (source = "simulated", never real data).
 * - A future vendor SDK implements this interface on a gym-owned PC (local
 *   connector, see docs/attendance-integration.md); its `fetchAttendanceEvents`
 *   output POSTs to `/api/v1/devices/events:ingest`, which is the server side
 *   of the HttpPush flavour of this contract.
 */

export interface RawDeviceEvent {
  deviceEventId?: string;
  deviceUserId: string;
  /** ISO instant from the device clock. */
  occurredAt: string;
}

export interface DeviceInfo {
  model: string;
  firmware: string;
}

export interface AttendanceDeviceAdapter {
  connect(): Promise<void>;
  getDeviceInfo(): Promise<DeviceInfo>;
  fetchAttendanceEvents(
    cursor?: string,
  ): Promise<{ events: RawDeviceEvent[]; nextCursor?: string }>;
  mapDeviceUser(deviceUserId: string): Promise<string | null>;
  acknowledgeEvents(eventIds: string[]): Promise<void>;
  healthCheck(): Promise<{ ok: boolean; lastSyncAt: string }>;
}

export interface IngestSummary {
  fetched: number;
  ingested: number;
  duplicates: number;
  unmapped: number;
  errors: { index: number; error: string }[];
}

/** Dev/test only. Every event it yields is flagged simulated at ingestion. */
export class SimulatedAdapter implements AttendanceDeviceAdapter {
  private connected = false;
  private cursor = 0;
  constructor(
    private readonly deviceUsers: string[] = [],
    private readonly batchSize = 10,
  ) {}

  async connect(): Promise<void> {
    this.connected = true;
  }

  async getDeviceInfo(): Promise<DeviceInfo> {
    return { model: "simulated-fp-01", firmware: "dev" };
  }

  async fetchAttendanceEvents(
    cursor?: string,
  ): Promise<{ events: RawDeviceEvent[]; nextCursor?: string }> {
    if (!this.connected) throw new Error("simulated device not connected");
    const start = cursor ? Number(cursor) : this.cursor;
    const now = Date.now();
    const events: RawDeviceEvent[] = [];
    for (let i = 0; i < this.batchSize; i++) {
      const n = start + i;
      const user =
        this.deviceUsers.length > 0
          ? this.deviceUsers[n % this.deviceUsers.length]
          : `sim-unknown-${n % 3}`;
      events.push({
        deviceEventId: `sim-${n}`,
        deviceUserId: user,
        occurredAt: new Date(now - (this.batchSize - i) * 60_000).toISOString(),
      });
    }
    this.cursor = start + this.batchSize;
    return { events, nextCursor: String(this.cursor) };
  }

  async mapDeviceUser(_deviceUserId: string): Promise<string | null> {
    return null; // mappings live in the application DB, resolved at ingestion
  }

  async acknowledgeEvents(_eventIds: string[]): Promise<void> {
    // no-op for the simulator
  }

  async healthCheck(): Promise<{ ok: boolean; lastSyncAt: string }> {
    return { ok: this.connected, lastSyncAt: new Date().toISOString() };
  }
}
