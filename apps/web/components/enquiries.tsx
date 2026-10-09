import { ENQUIRY_STATUSES } from "@o2app/shared";

export function statusLabel(key: string): string {
  return ENQUIRY_STATUSES.find((s) => s.key === key)?.label ?? key;
}

export function EnquiryStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "new":
      return <span className="badge-blue">New</span>;
    case "contacted":
      return <span className="badge">Contacted</span>;
    case "follow_up":
      return <span className="badge-amber">Follow-up</span>;
    case "trial":
      return <span className="badge-blue">Trial</span>;
    case "interested":
      return <span className="badge-green">Interested</span>;
    case "converted":
      return <span className="badge-green">Converted</span>;
    case "lost":
      return <span className="badge">Lost</span>;
    default:
      return <span className="badge">{status}</span>;
  }
}

export interface EnquiryRow {
  id: string;
  enquiryNo: string;
  name: string;
  phone: string;
  status: string;
  source: string | null;
  nextFollowUpAt: string | null;
  overdue?: boolean;
  assignedTo: { id: string; name: string } | null;
  _count?: { followUps: number };
}
