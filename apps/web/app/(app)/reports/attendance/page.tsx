export default function AttendanceReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b">
        <button 
          className="px-4 py-2 text-sm font-medium border-b-2 border-brand-600 text-brand-700"
        >
          Daily Check-ins
        </button>
        <button 
          className="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-stone-500 hover:text-stone-700"
        >
          Absentees
        </button>
      </div>

      <div className="card flex flex-col items-center justify-center p-16 text-center text-stone-500 border-2 border-dashed rounded-lg">
         <h2 className="text-xl font-semibold text-stone-700 mb-2">Attendance Reports</h2>
         <p className="max-w-md">
            This module will show the daily check-ins from the biometric devices and identify members who haven't visited in a while. 
            (Pending backend API implementation for detailed attendance)
         </p>
      </div>
    </div>
  );
}
