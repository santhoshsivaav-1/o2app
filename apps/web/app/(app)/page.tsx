"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../lib/auth";

function StatCard({ title, value, subtext, highlight }: { title: string, value: string | number, subtext: string, highlight?: boolean }) {
  return (
    <div className="card border-l-4 border-l-transparent transition hover:border-l-brand-500">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{title}</p>
      <p className={`mt-2 text-3xl font-bold ${highlight ? 'text-brand-600' : 'text-stone-900'}`}>{value}</p>
      <p className="mt-1 text-xs text-stone-500">{subtext}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { user, has } = useAuth();

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ["owner-dashboard"],
    queryFn: () => apiFetch<any>("/reports/dashboard/owner"),
    enabled: has("reports:read") || has("reports.read"),
  });

  if (!has("reports:read") && !has("reports.read")) {
    return <div className="p-8 text-center text-stone-500">You do not have permission to view the dashboard.</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Business Performance</h1>
        <p className="page-sub">Welcome back, {user?.name?.split(" ")[0]}. Here is your operational overview.</p>
      </div>

      {isLoading ? (
        <p className="text-stone-500">Loading dashboard data...</p>
      ) : dashboard ? (
        <>
          <section>
            <h2 className="text-lg font-semibold text-stone-800 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span> Business Overview
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Total Members" value={dashboard.business.totalMembers} subtext="Lifetime registered members" />
              <StatCard title="Active Members" value={dashboard.business.activeMembers} subtext="Valid memberships today" highlight />
              <StatCard title="Expired Memberships" value={dashboard.business.expiredMemberships} subtext="Awaiting renewal or review" />
              <StatCard title="Expiring in 7 Days" value={dashboard.business.expiringIn7Days} subtext="Renewal opportunities" />
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-800 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span> Financial Overview
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Today's Collections" value={`₹${dashboard.financial.todayCollections}`} subtext="Payments received today" highlight />
              <StatCard title="Month's Collections" value={`₹${dashboard.financial.monthCollections}`} subtext="Payments received this month" />
              <StatCard title="Outstanding Balance" value={`₹${dashboard.financial.outstandingBalance}`} subtext="Unpaid invoice totals" />
              <StatCard title="Refunds This Month" value={`₹${dashboard.financial.monthRefunds}`} subtext="Processed refunds" />
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-800 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span> Attendance & Acquisition
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Today's Check-ins" value={dashboard.attendance.todayCheckIns} subtext="Total attendance today" highlight />
              <StatCard title="New Registrations" value={dashboard.attendance.newRegistrations} subtext="Members joined today" />
              <StatCard title="New Enquiries" value={dashboard.attendance.newEnquiries} subtext="Leads captured today" />
              <StatCard title="Follow-ups Overdue" value={dashboard.attendance.overdueFollowUps} subtext="Requires immediate action" />
            </div>
          </section>
          
          <section>
            <h2 className="text-lg font-semibold text-stone-800 mb-4">Actionable Alerts (P1)</h2>
            <div className="flex gap-4 flex-wrap">
               {dashboard.business.expiringIn7Days > 0 && (
                  <Link href="/reports" className="bg-orange-100 text-orange-800 px-4 py-3 rounded-lg text-sm font-medium hover:bg-orange-200 transition">
                    {dashboard.business.expiringIn7Days} Memberships expiring soon →
                  </Link>
               )}
               {dashboard.attendance.overdueFollowUps > 0 && (
                  <Link href="/enquiries" className="bg-red-100 text-red-800 px-4 py-3 rounded-lg text-sm font-medium hover:bg-red-200 transition">
                    {dashboard.attendance.overdueFollowUps} Overdue Follow-ups →
                  </Link>
               )}
               {dashboard.financial.outstandingBalance > 0 && (
                  <Link href="/billing" className="bg-yellow-100 text-yellow-800 px-4 py-3 rounded-lg text-sm font-medium hover:bg-yellow-200 transition">
                    Pending Balances to Collect →
                  </Link>
               )}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
