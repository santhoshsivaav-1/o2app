import { PAYMENT_METHODS } from "@o2app/shared";

export function methodLabel(key: string): string {
  return PAYMENT_METHODS.find((m) => m.key === key)?.label ?? key;
}

export function InvoiceStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "paid":
      return <span className="badge-green">Paid</span>;
    case "partial":
      return <span className="badge-amber">Partial</span>;
    case "refunded":
      return <span className="badge-blue">Refunded</span>;
    default:
      return <span className="badge">Unpaid</span>;
  }
}

export interface OpenInvoice {
  id: string;
  invoiceNo: string;
  total: string;
  paid: number;
  outstanding: number;
  status: string;
}

export interface PaymentRow {
  id: string;
  method: string;
  amount: string;
  paidAt: string;
  reference: string | null;
  verified: boolean;
  member: { id: string; memberCode: string; fullName: string };
}

export function inr(n: string | number): string {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
