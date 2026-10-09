"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../../../lib/api";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function AttendanceReportsPage() {
  const searchParams = useSearchParams();
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const dateQuery = (start && end) ? `?start=${start}&end=${end}` : "";

  const [activeTab, setActiveTab] = useState("checkins");

  const { data: attendance, isLoading } = useQuery({
    queryKey: ["attendance-report", start, end],
    queryFn: () => apiFetch<any>(`/reports/attendance${dateQuery}`),
  });

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b overflow-x-auto">
        <button 
          onClick={() => setActiveTab("checkins")}
          className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === 'checkins' ? 'border-brand-600 text-brand-700' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
        >
          Daily Check-ins
        </button>
        <button 
          onClick={() => setActiveTab("absentees")}
          className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === 'absentees' ? 'border-brand-600 text-brand-700' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
        >
          Absentees
        </button>
      </div>

      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
           <h2 className="text-lg font-semibold text-stone-800">
              {activeTab === 'checkins' && "Daily Check-ins (Date Range)"}
              {activeTab === 'absentees' && "Members Absent for 7+ Days"}
           </h2>
           <div className="flex gap-2">
              <button className="btn-secondary text-sm">Export CSV</button>
           </div>
        </div>

        {activeTab === 'checkins' && (
          isLoading ? (
            <p className="text-sm text-stone-500">Loading check-ins...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-stone-600">
                <thead className="border-b text-xs uppercase text-stone-500 bg-stone-50">
                  <tr>
                    <th className="py-2 px-4 font-semibold">Date</th>
                    <th className="py-2 px-4 font-semibold">Time</th>
                    <th className="py-2 px-4 font-semibold">Member</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {attendance?.checkIns.map((ci: any) => (
                    <tr key={ci.id} className="hover:bg-stone-50">
                      <td className="py-3 px-4 whitespace-nowrap">{new Date(ci.date).toLocaleDateString()}</td>
                      <td className="py-3 px-4 whitespace-nowrap">{new Date(ci.checkInAt).toLocaleTimeString()}</td>
                      <td className="py-3 px-4 font-medium text-stone-900">{ci.member.fullName} ({ci.member.memberCode})</td>
                    </tr>
                  ))}
                  {attendance?.checkIns.length === 0 && (
                    <tr><td colSpan={3} className="py-4 text-center text-stone-500">No check-ins found for this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )
        )}

        {activeTab === 'absentees' && (
          isLoading ? (
            <p className="text-sm text-stone-500">Loading absentees...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-stone-600">
                <thead className="border-b text-xs uppercase text-stone-500 bg-stone-50">
                  <tr>
                    <th className="py-2 px-4 font-semibold">Member</th>
                    <th className="py-2 px-4 font-semibold">Mobile</th>
                    <th className="py-2 px-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {attendance?.absentees.map((member: any) => (
                    <tr key={member.id} className="hover:bg-stone-50">
                      <td className="py-3 px-4 font-medium text-stone-900">{member.fullName} ({member.memberCode})</td>
                      <td className="py-3 px-4">{member.mobileNorm}</td>
                      <td className="py-3 px-4"><span className="badge-amber">Absent &gt; 7 days</span></td>
                    </tr>
                  ))}
                  {attendance?.absentees.length === 0 && (
                    <tr><td colSpan={3} className="py-4 text-center text-stone-500">Great! All active members have visited recently.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}
