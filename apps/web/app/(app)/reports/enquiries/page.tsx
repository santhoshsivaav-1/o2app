"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../../../lib/api";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function EnquiriesReportsPage() {
  const searchParams = useSearchParams();
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const dateQuery = (start && end) ? `?start=${start}&end=${end}` : "";

  const [activeTab, setActiveTab] = useState("recent");

  const { data: report, isLoading } = useQuery({
    queryKey: ["enquiries-report", start, end],
    queryFn: () => apiFetch<any>(`/reports/enquiries${dateQuery}`),
  });

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b">
        <button 
          onClick={() => setActiveTab("recent")}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'recent' ? 'border-brand-600 text-brand-700' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
        >
          Recent Enquiries
        </button>
        <button 
          onClick={() => setActiveTab("overdue")}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'overdue' ? 'border-red-600 text-red-700' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
        >
          Overdue Follow-ups
        </button>
      </div>

      <div className="card">
        {isLoading ? (
          <p className="text-sm text-stone-500">Loading enquiries data...</p>
        ) : activeTab === "recent" ? (
          <div className="overflow-x-auto">
            <h2 className="text-lg font-semibold text-stone-800 mb-4">Latest 50 Enquiries</h2>
            <table className="w-full text-left text-sm text-stone-600">
              <thead className="border-b text-xs uppercase text-stone-500">
                <tr>
                  <th className="py-2 px-4 font-semibold">Name</th>
                  <th className="py-2 px-4 font-semibold">Phone</th>
                  <th className="py-2 px-4 font-semibold">Interest</th>
                  <th className="py-2 px-4 font-semibold">Assigned To</th>
                  <th className="py-2 px-4 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report?.recentEnquiries.map((e: any) => (
                  <tr key={e.id} className="hover:bg-stone-50">
                    <td className="py-3 px-4 font-medium text-stone-900">{e.name}</td>
                    <td className="py-3 px-4">{e.phoneNorm}</td>
                    <td className="py-3 px-4">{e.interestPackage?.name || "General"}</td>
                    <td className="py-3 px-4">{e.assignedTo?.name || "Unassigned"}</td>
                    <td className="py-3 px-4">{new Date(e.enquiryDate).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <h2 className="text-lg font-semibold text-red-700 mb-4">Needs Immediate Action</h2>
            <table className="w-full text-left text-sm text-stone-600">
              <thead className="border-b text-xs uppercase text-stone-500">
                <tr>
                  <th className="py-2 px-4 font-semibold">Prospect Name</th>
                  <th className="py-2 px-4 font-semibold">Phone</th>
                  <th className="py-2 px-4 font-semibold">Activity</th>
                  <th className="py-2 px-4 font-semibold">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report?.overdueFollowUps.map((f: any) => (
                  <tr key={f.id} className="hover:bg-red-50">
                    <td className="py-3 px-4 font-medium text-stone-900">{f.enquiry?.name}</td>
                    <td className="py-3 px-4">{f.enquiry?.phoneNorm}</td>
                    <td className="py-3 px-4">{f.activity}</td>
                    <td className="py-3 px-4 text-red-600 font-bold">{new Date(f.dueAt).toLocaleDateString()}</td>
                  </tr>
                ))}
                {report?.overdueFollowUps.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 px-4 text-center text-stone-500">No overdue follow-ups! Great job.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
