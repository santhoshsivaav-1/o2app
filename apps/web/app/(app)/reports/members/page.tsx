"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../../../lib/api";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

type ExpiringMembership = {
  id: string;
  endDate: string;
  status: string;
  member: { id: string; fullName: string; mobileNorm: string };
  package: { id: string; name: string };
};

export default function MembersReportsPage() {
  const searchParams = useSearchParams();
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const dateQuery = (start && end) ? `?start=${start}&end=${end}` : "";

  const [days, setDays] = useState(30);
  const [activeTab, setActiveTab] = useState("expiring");

  const { data: expiring, isLoading: expiringLoading } = useQuery({
    queryKey: ["expiring-memberships", days],
    queryFn: () => apiFetch<ExpiringMembership[]>(`/reports/expiring-memberships?days=${days}`),
  });

  const { data: monthly, isLoading: monthlyLoading } = useQuery({
    queryKey: ["monthly-demographics", start, end],
    queryFn: () => apiFetch<any>(`/reports/monthly-demographics${dateQuery}`),
  });

  return (
    <div className="space-y-6">
      
      <div className="flex gap-2 border-b">
        <button 
          onClick={() => setActiveTab("expiring")}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'expiring' ? 'border-brand-600 text-brand-700' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
        >
          Expiring Memberships
        </button>
        <button 
          onClick={() => setActiveTab("monthly")}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'monthly' ? 'border-brand-600 text-brand-700' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
        >
          Monthly Demographics
        </button>
      </div>

      {activeTab === "expiring" && (
        <div className="card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-stone-800">Renewal Opportunities</h2>
            <div className="flex gap-2">
               <select
                 value={days}
                 onChange={(e) => setDays(Number(e.target.value))}
                 className="input text-sm"
               >
                 <option value={7}>Next 7 Days</option>
                 <option value={15}>Next 15 Days</option>
                 <option value={30}>Next 30 Days</option>
                 <option value={60}>Next 60 Days</option>
               </select>
               <button className="btn-secondary text-sm">Export CSV</button>
            </div>
          </div>

          {expiringLoading ? (
            <p className="text-sm text-stone-500">Loading report...</p>
          ) : expiring && expiring.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-stone-600">
                <thead className="border-b text-xs uppercase text-stone-500">
                  <tr>
                    <th className="py-2 px-4 font-semibold">Member</th>
                    <th className="py-2 px-4 font-semibold">Phone</th>
                    <th className="py-2 px-4 font-semibold">Package</th>
                    <th className="py-2 px-4 font-semibold">Expiry Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {expiring.map((m) => (
                    <tr key={m.id} className="hover:bg-stone-50">
                      <td className="py-3 px-4 font-medium text-stone-900">{m.member.fullName}</td>
                      <td className="py-3 px-4">{m.member.mobileNorm}</td>
                      <td className="py-3 px-4">{m.package.name}</td>
                      <td className="py-3 px-4 text-red-600 font-medium">
                        {new Date(m.endDate).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-stone-500">No memberships expiring in the next {days} days.</p>
          )}
        </div>
      )}

      {activeTab === "monthly" && (
        <div className="card space-y-4">
           <h2 className="text-lg font-semibold text-stone-800">Registration & Renewal by Gender ({monthly?.range})</h2>
           
           {monthlyLoading ? (
             <p className="text-sm text-stone-500">Loading demographic data...</p>
           ) : (
             <div className="grid sm:grid-cols-2 gap-6">
                <div className="border rounded-lg p-6 bg-blue-50/30">
                  <h3 className="font-semibold text-stone-700 mb-4 border-b pb-2">New Registrations</h3>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-stone-600">Men</span>
                    <span className="font-bold text-xl">{monthly?.newRegistrations.men}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-stone-600">Women</span>
                    <span className="font-bold text-xl">{monthly?.newRegistrations.women}</span>
                  </div>
                </div>

                <div className="border rounded-lg p-6 bg-green-50/30">
                  <h3 className="font-semibold text-stone-700 mb-4 border-b pb-2">Renewals</h3>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-stone-600">Men</span>
                    <span className="font-bold text-xl">{monthly?.renewals.men}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-stone-600">Women</span>
                    <span className="font-bold text-xl">{monthly?.renewals.women}</span>
                  </div>
                </div>
             </div>
           )}
        </div>
      )}
    </div>
  );
}
