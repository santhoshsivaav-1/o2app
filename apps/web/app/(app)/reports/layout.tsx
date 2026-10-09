"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export default function ReportsLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const start = searchParams.get("start") || "";
  const end = searchParams.get("end") || "";

  const handleApply = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const s = fd.get("start") as string;
    const en = fd.get("end") as string;
    const params = new URLSearchParams(searchParams.toString());
    if (s) params.set("start", s); else params.delete("start");
    if (en) params.set("end", en); else params.delete("end");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-sub">View actionable insights, detailed reports, and export data.</p>
        </div>
        <form onSubmit={handleApply} className="flex items-center gap-2 bg-white p-2 rounded-lg border shadow-sm">
          <input type="date" name="start" defaultValue={start} className="input text-sm py-1.5" title="Start Date" />
          <span className="text-stone-400 text-sm">to</span>
          <input type="date" name="end" defaultValue={end} className="input text-sm py-1.5" title="End Date" />
          <button type="submit" className="bg-stone-800 text-white rounded-md text-sm py-1.5 px-4 font-medium hover:bg-stone-700 transition">
            Apply Filter
          </button>
        </form>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        <aside className="w-full md:w-56 shrink-0 bg-white rounded-xl border p-2 shadow-sm">
          <nav className="flex md:flex-col gap-1 overflow-x-auto">
            <Link href="/reports/members" className="px-3 py-2 rounded-lg text-sm font-medium hover:bg-brand-50 hover:text-brand-700 text-stone-700 whitespace-nowrap transition">
              Members & Renewals
            </Link>
            <Link href="/reports/financial" className="px-3 py-2 rounded-lg text-sm font-medium hover:bg-brand-50 hover:text-brand-700 text-stone-700 whitespace-nowrap transition">
              Financials
            </Link>
            <Link href="/reports/attendance" className="px-3 py-2 rounded-lg text-sm font-medium hover:bg-brand-50 hover:text-brand-700 text-stone-700 whitespace-nowrap transition">
              Attendance
            </Link>
            <Link href="/reports/enquiries" className="px-3 py-2 rounded-lg text-sm font-medium hover:bg-brand-50 hover:text-brand-700 text-stone-700 whitespace-nowrap transition">
              Enquiries & Leads
            </Link>
          </nav>
        </aside>
        
        <main className="flex-1 min-w-0 w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
