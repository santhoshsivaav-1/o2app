export type Validity = "scheduled" | "active" | "expired" | "suspended" | "cancelled" | "none";

export interface MembershipRow {
  id: string;
  startDate: string;
  endDate: string;
  status: string;
  total: string;
  validity: Validity;
  member: { id: string; memberCode: string; fullName: string; mobile: string };
  package: { id: string; name: string };
  ptTotal?: string;
  ptDurationMonths?: number;
  ptStart?: string | null;
  ptTrainer?: { id: string; name: string } | null;
  ptEnd?: string | null;
}

/** Small "PT" pill shown when a membership carries a personal-training package. */
export function PtBadge({ row }: { row: { ptTotal?: string | number; ptTrainer?: { name: string } | null } }) {
  if (!row.ptTotal || Number(row.ptTotal) <= 0) return null;
  return (
    <span className="badge-blue" title={`PT trainer: ${row.ptTrainer?.name ?? "—"}`}>
      PT · {Number(row.ptTotal).toLocaleString("en-IN")}
    </span>
  );
}

export function ValidityBadge({ validity }: { validity: string }) {
  switch (validity) {
    case "active":
      return <span className="badge-green">Active</span>;
    case "scheduled":
      return <span className="badge-blue">Scheduled</span>;
    case "expired":
      return <span className="badge-amber">Expired</span>;
    case "suspended":
      return <span className="badge-amber">Suspended</span>;
    case "cancelled":
      return <span className="badge">Cancelled</span>;
    default:
      return <span className="badge">{validity}</span>;
  }
}

export function inr(n: string | number): string {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}
