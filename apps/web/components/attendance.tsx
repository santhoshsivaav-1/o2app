export function SourceBadge({ source }: { source: string }) {
  if (source === "manual") return <span className="badge-blue">Manual</span>;
  if (source === "simulated") return <span className="badge-amber">Simulated</span>;
  return <span className="badge-green">Device</span>;
}

export interface AttendanceRecordRow {
  id: string;
  date: string;
  checkInAt: string;
  source: string;
  member: { id: string; memberCode: string; fullName: string; mobile?: string };
}

export interface UnmappedRow {
  id: string;
  deviceUserId: string;
  deviceEventId: string | null;
  occurredAt: string;
  source: string;
  device: { id: string; deviceCode: string; name: string } | null;
}

export interface DeviceRow {
  id: string;
  deviceCode: string;
  name: string;
  model: string | null;
  isActive: boolean;
  duplicateWindowMin: number;
  lastSeenAt: string | null;
}
