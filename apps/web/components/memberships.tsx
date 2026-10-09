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
