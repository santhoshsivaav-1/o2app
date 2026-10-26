import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PAYMENT_METHODS } from "@o2app/shared";
import { ApiError, apiFetch } from "../lib/api";

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
  type?: string;
  notes?: string | null;
  member: { id: string; memberCode: string; fullName: string };
}

export function PaymentTypeBadge({ type }: { type?: string }) {
  if (type === "pt") return <span className="badge-blue">PT</span>;
  return <span className="badge">Membership</span>;
}

export function inr(n: string | number): string {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/**
 * Quick payment collection modal for a member.
 * Mirrors the exact payload of Billing → Collect (POST /payments with allocations).
 * `invoiceId?` pre-fills the allocation for that single invoice.
 */
export function CollectPaymentModal({
  memberId,
  memberName,
  invoiceId,
  onClose,
  onDone,
}: {
  memberId: string;
  memberName: string;
  /** When given, only this invoice's outstanding is pre-filled and shown. */
  invoiceId?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [allocs, setAllocs] = useState<Record<string, number>>({});
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);

  const open = useQuery({
    queryKey: ["collect-modal-open", memberId],
    queryFn: () => apiFetch<{ data: OpenInvoice[] }>(`/invoices?memberId=${memberId}&limit=50`),
  });

  const targets =
    (open.data?.data ?? []).filter(
      (i) => i.outstanding > 0 && (!invoiceId || i.id === invoiceId),
    ) ?? [];
  const allocSum = targets.reduce(
    (n, i) =>
      n + (allocs[i.id] !== undefined ? Number(allocs[i.id]) || 0 : i.outstanding),
    0,
  );
  const needsRef = PAYMENT_METHODS.find((m) => m.key === method)?.needsReference;

  const collect = useMutation({
    mutationFn: () =>
      apiFetch<{ payment: { id: string } }>("/payments", {
        method: "POST",
        body: JSON.stringify({
          memberId,
          method,
          amount: allocSum,
          paidAt,
          type: "membership",
          notes: notes || undefined,
          reference: reference || undefined,
          allocations: targets.map((i) => ({
            invoiceId: i.id,
            amount:
              allocs[i.id] !== undefined ? Number(allocs[i.id]) || 0 : i.outstanding,
          })),
          idempotencyKey:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random()}`,
        }),
      }),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["bill-open"] });
      queryClient.invalidateQueries({ queryKey: ["collect-modal-open", memberId] });
      onDone();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Payment failed"),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-4 shadow-xl">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-stone-900">Collect payment</h3>
          <span className="text-sm text-stone-500">{memberName}</span>
          <button className="btn-ghost ml-auto px-2 py-1 text-xs" onClick={onClose}>
            ✕
          </button>
        </div>

        {open.isLoading && <p className="mt-3 text-sm text-stone-500">Loading invoices…</p>}
        {!open.isLoading && targets.length === 0 && (
          <p className="mt-3 text-sm text-stone-500">No unpaid invoices — nothing to collect.</p>
        )}

        {targets.length > 0 && (
          <div className="mt-3 space-y-3">
            <ul className="space-y-2">
              {targets.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
                >
                  <span className="font-medium">{inv.invoiceNo}</span>
                  <span className="text-xs text-stone-500 tabular-nums">
                    total {inr(inv.total)} · outstanding {inr(inv.outstanding)}
                  </span>
                  <input
                    className="input ml-auto w-28 py-1 text-right text-sm tabular-nums"
                    type="number"
                    min={1}
                    max={inv.outstanding}
                    step="0.01"
                    value={allocs[inv.id] ?? inv.outstanding}
                    onChange={(e) =>
                      setAllocs((a) => ({ ...a, [inv.id]: Number(e.target.value) }))
                    }
                  />
                </li>
              ))}
            </ul>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between border-t border-stone-200 pt-2 font-medium">
                <span>Collecting</span>
                <span className="tabular-nums">{inr(allocSum)}</span>
              </div>
              <select
                className="input w-full text-sm"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm.key} value={pm.key}>
                    {pm.label}
                  </option>
                ))}
              </select>
              {needsRef && (
                <input
                  className="input w-full text-sm"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Reference (txn / cheque no.)"
                />
              )}
              <input
                className="input w-full text-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes (optional)"
              />
              <label className="block text-xs text-stone-500">
                Paid on
                <input
                  className="input mt-1 w-full text-sm"
                  type="date"
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                />
              </label>
            </div>

            {error && <p className="alert-error text-sm">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                className="btn-primary flex-1 text-sm"
                disabled={collect.isPending || allocSum <= 0}
                onClick={() => {
                  const tooMuch = targets.some(
                    (i) =>
                      (allocs[i.id] !== undefined ? Number(allocs[i.id]) || 0 : i.outstanding) >
                      i.outstanding + 1e-9,
                  );
                  if (allocSum <= 0) {
                    setError("Enter an amount to collect");
                    return;
                  }
                  if (tooMuch) {
                    setError("An allocation exceeds the invoice outstanding");
                    return;
                  }
                  collect.mutate();
                }}
              >
                {collect.isPending ? "Recording…" : `Record ${inr(allocSum)}`}
              </button>
              <button className="btn-ghost text-sm" onClick={onClose}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
