import { useState, useEffect } from "react";
import { FaChartBar, FaUserFriends, FaMoneyBillWave, FaDownload } from "react-icons/fa";
import { fetchWithAuth, API_BASE } from "../../api";
import { useBranch } from "../../context/BranchContext";

const HRReportsPage = () => {
  const { currentBranch } = useBranch();
  const [month, setMonth] = useState(new Date().toISOString().substring(0, 7));
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [currentBranch, month]);

  const fetchHistory = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/hr/payroll/history?branchId=${currentBranch?._id}&month=${month}`);
      const data = await res.json();
      if (data.success) {
        setRecords(data.data);
      }
    } catch (err) {} finally {
      setLoading(false);
    }
  };

  const totalExpense = records.reduce((sum, r) => sum + r.netSalary, 0);
  const paidCount = records.filter(r => r.status === "Paid").length;
  const pendingCount = records.length - paidCount;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">HR Payroll Reports</h1>
          <p className="text-slate-500 text-sm font-medium uppercase tracking-widest">Financial summary of employee costs</p>
        </div>
        <div className="flex items-center gap-3">
          <input 
            type="month" 
            value={month} 
            onChange={(e) => setMonth(e.target.value)}
            className="bg-white border border-slate-200 rounded-2xl px-4 py-2 text-sm font-bold text-slate-700 uppercase focus:ring-2 focus:ring-indigo-100"
          />
          <button className="bg-slate-800 text-white p-3 rounded-2xl hover:bg-black transition shadow-lg">
            <FaDownload />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mb-4">
              <FaMoneyBillWave className="text-xl" />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Payroll Value</p>
            <p className="text-3xl font-black text-slate-800 tracking-tighter">₹{totalExpense.toLocaleString()}</p>
         </div>

         <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mb-4">
              <FaUserFriends className="text-xl" />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Employees Processed</p>
            <p className="text-3xl font-black text-slate-800 tracking-tighter">{records.length}</p>
         </div>

         <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mb-4">
              <FaChartBar className="text-xl" />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Payment Status</p>
            <div className="flex items-center gap-4 mt-1">
               <div>
                 <p className="text-lg font-black text-emerald-500 leading-none">{paidCount}</p>
                 <p className="text-[8px] font-bold text-slate-400 uppercase">Paid</p>
               </div>
               <div className="w-[1px] h-6 bg-slate-100"></div>
               <div>
                 <p className="text-lg font-black text-amber-500 leading-none">{pendingCount}</p>
                 <p className="text-[8px] font-bold text-slate-400 uppercase">Pending</p>
               </div>
            </div>
         </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
         <table className="w-full text-left">
            <thead>
               <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Basic</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Bonus/OT</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Deduction</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Net Salary</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
               </tr>
            </thead>
            <tbody>
               {records.map((record) => (
                  <tr key={record._id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-all">
                     <td className="px-8 py-5">
                        <p className="text-xs font-black text-slate-800 uppercase">{record.employeeId?.name}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{record.employeeId?.role}</p>
                     </td>
                     <td className="px-8 py-5 text-xs font-bold text-slate-700 text-right">₹{record.basicSalary.toLocaleString()}</td>
                     <td className="px-8 py-5 text-xs font-bold text-slate-700 text-right">₹{(record.bonus + record.overtimePay).toLocaleString()}</td>
                     <td className="px-8 py-5 text-xs font-bold text-rose-500 text-right">₹{record.deductions.toLocaleString()}</td>
                     <td className="px-8 py-5 text-xs font-black text-slate-800 text-right">₹{record.netSalary.toLocaleString()}</td>
                     <td className="px-8 py-5 text-center">
                        <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-tighter ${record.status === "Paid" ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}`}>
                           {record.status}
                        </span>
                     </td>
                  </tr>
               ))}
               {records.length === 0 && (
                 <tr>
                    <td colSpan="6" className="px-8 py-20 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                       No data available for this month
                    </td>
                 </tr>
               )}
            </tbody>
         </table>
      </div>
    </div>
  );
};

export default HRReportsPage;
