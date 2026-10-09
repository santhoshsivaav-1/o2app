"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../../../lib/api";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function FinancialReportsPage() {
  const searchParams = useSearchParams();
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const dateQuery = (start && end) ? `?start=${start}&end=${end}` : "";

  const [activeTab, setActiveTab] = useState("packages");

  const { data: billings, isLoading: billingsLoading } = useQuery({
    queryKey: ["billings-report", start, end],
    queryFn: () => apiFetch<any>(`/reports/billings${dateQuery}`),
  });

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b overflow-x-auto">
        <button 
          onClick={() => setActiveTab("packages")}
          className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === 'packages' ? 'border-brand-600 text-brand-700' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
        >
          Package Billings
        </button>
        <button 
          onClick={() => setActiveTab("collections")}
          className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === 'collections' ? 'border-brand-600 text-brand-700' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
        >
          Daily Collections
        </button>
        <button 
          onClick={() => setActiveTab("outstanding")}
          className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === 'outstanding' ? 'border-brand-600 text-brand-700' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
        >
          Outstanding Balances
        </button>
      </div>

      <div className="card">
         <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold text-stone-800">
               {activeTab === 'packages' && `Package Sales Revenue (${billings?.range || 'Loading...'})`}
               {activeTab === 'collections' && "Daily Payment Collections"}
               {activeTab === 'outstanding' && "Unpaid & Partial Invoices"}
            </h2>
            <div className="flex gap-2">
               <button className="btn-secondary text-sm">Export CSV</button>
            </div>
         </div>
         
         {activeTab === 'packages' ? (
           billingsLoading ? (
             <p className="text-sm text-stone-500">Loading package data...</p>
           ) : (
             <div className="overflow-x-auto">
               <table className="w-full text-left text-sm text-stone-600">
                 <thead className="border-b text-xs uppercase text-stone-500">
                   <tr>
                     <th className="py-2 px-4 font-semibold">Package Name</th>
                     <th className="py-2 px-4 font-semibold text-right">Total Memberships Sold</th>
                     <th className="py-2 px-4 font-semibold text-right">Gross Revenue Generated</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y">
                   {billings?.packagePerformance.map((p: any) => (
                     <tr key={p.packageName} className="hover:bg-stone-50">
                       <td className="py-3 px-4 font-medium text-stone-900">{p.packageName}</td>
                       <td className="py-3 px-4 text-right">{p.count}</td>
                       <td className="py-3 px-4 text-right font-bold text-green-700">₹{p.revenue}</td>
                     </tr>
                   ))}
                   {billings?.packagePerformance.length === 0 && (
                     <tr><td colSpan={3} className="py-4 text-center text-stone-500">No packages sold this month.</td></tr>
                   )}
                 </tbody>
               </table>
             </div>
           )
         ) : (
           <div className="p-12 text-center text-stone-500 border-2 border-dashed rounded-lg">
              {activeTab === 'collections' && "Daily Collections data grid will appear here (Requires GET /reports/financial/collections endpoint)"}
              {activeTab === 'outstanding' && "Outstanding balances aging report will appear here (Requires GET /reports/financial/outstanding endpoint)"}
           </div>
         )}
      </div>
    </div>
  );
}
