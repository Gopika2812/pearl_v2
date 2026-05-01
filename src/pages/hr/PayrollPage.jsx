import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { FaMoneyCheck, FaPlay, FaCheckCircle, FaExclamationCircle, FaUser } from "react-icons/fa";
import { fetchWithAuth, API_BASE } from "../../api";
import { useBranch } from "../../context/BranchContext";

const PayrollPage = () => {
  const { currentBranch } = useBranch();
  const [employees, setEmployees] = useState([]);
  const [payrollHistory, setPayrollHistory] = useState([]);
  const [month, setMonth] = useState(new Date().toISOString().substring(0, 7));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployees();
    fetchHistory();
  }, [currentBranch, month]);

  const fetchEmployees = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/branch-users?branchId=${currentBranch?._id}`);
      const data = await res.json();
      if (data.success) {
        setEmployees(data.data.filter(u => u.status === "ACTIVE"));
      }
    } catch (err) {
      toast.error("Failed to fetch employees");
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/hr/payroll/history?branchId=${currentBranch?._id}&month=${month}`);
      const data = await res.json();
      if (data.success) {
        setPayrollHistory(data.data);
      }
    } catch (err) {}
  };

  const handleProcess = async (employeeId) => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/hr/payroll/generate`, {
        method: "POST",
        body: JSON.stringify({
          employeeId,
          month,
          workingDays: 30, // Default for now, could be dynamic
          branchId: currentBranch?._id
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Payroll calculated successfully");
        fetchHistory();
      } else {
        toast.error(data.message || "Failed to process payroll");
      }
    } catch (err) {
      toast.error("Error processing payroll");
    }
  };

  const handleMarkPaid = async (payrollId) => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/hr/payroll/status/${payrollId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "Paid" })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Payroll marked as Paid. Zoho Expense created.");
        fetchHistory();
      }
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Payroll Processing</h1>
          <p className="text-slate-500 text-sm font-medium uppercase tracking-widest">Calculate and payout monthly salaries</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
          <input 
            type="month" 
            value={month} 
            onChange={(e) => setMonth(e.target.value)}
            className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 uppercase"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Employee List to Process */}
        <div className="lg:col-span-1 space-y-4">
           <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
             <span className="w-6 h-[2px] bg-indigo-500"></span> Active Employees
           </h2>
           <div className="bg-white rounded-[2.5rem] border border-slate-200 p-2 overflow-hidden shadow-sm">
              <div className="max-h-[60vh] overflow-y-auto no-scrollbar">
                {employees.map(emp => {
                  const processed = payrollHistory.find(p => p.employeeId._id === emp._id);
                  return (
                    <div key={emp._id} className="group flex items-center justify-between p-4 hover:bg-slate-50 rounded-3xl transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500 text-sm">
                          <FaUser />
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-800 uppercase leading-tight">{emp.name}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{emp.role}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleProcess(emp._id)}
                        disabled={processed?.status === "Paid"}
                        className={`p-3 rounded-xl transition-all ${
                          processed 
                          ? "bg-emerald-50 text-emerald-500" 
                          : "bg-indigo-50 text-indigo-500 hover:bg-indigo-500 hover:text-white"
                        }`}
                        title={processed ? "Recalculate" : "Process Payroll"}
                      >
                        {processed ? <FaCheckCircle /> : <FaPlay />}
                      </button>
                    </div>
                  );
                })}
              </div>
           </div>
        </div>

        {/* Payroll History / Records */}
        <div className="lg:col-span-2 space-y-4">
           <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
             <span className="w-6 h-[2px] bg-emerald-500"></span> Payroll Records - {month}
           </h2>
           <div className="grid grid-cols-1 gap-4">
              {payrollHistory.length === 0 ? (
                <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-12 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                    <FaMoneyCheck className="text-2xl" />
                  </div>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">No payroll processed for this month</p>
                </div>
              ) : (
                payrollHistory.map(record => (
                  <div key={record._id} className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm hover:border-indigo-100 transition-all">
                    <div className="flex items-center gap-4">
                       <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${record.status === "Paid" ? "bg-emerald-50 text-emerald-500" : "bg-amber-50 text-amber-500"}`}>
                         {record.status === "Paid" ? <FaCheckCircle className="text-xl" /> : <FaExclamationCircle className="text-xl" />}
                       </div>
                       <div>
                         <h3 className="font-black text-slate-800 uppercase text-sm">{record.employeeId?.name}</h3>
                         <div className="flex items-center gap-2">
                           <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md uppercase">Net: ₹{record.netSalary.toLocaleString()}</span>
                           <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase ${record.status === "Paid" ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}`}>
                             {record.status}
                           </span>
                         </div>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 md:flex md:items-center gap-4 md:gap-8">
                       <div className="text-center md:text-left">
                         <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Basic</p>
                         <p className="text-xs font-bold text-slate-700">₹{record.basicSalary.toLocaleString()}</p>
                       </div>
                       <div className="text-center md:text-left">
                         <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">OT Pay</p>
                         <p className="text-xs font-bold text-slate-700">₹{record.overtimePay.toLocaleString()}</p>
                       </div>
                       <div className="text-center md:text-left">
                         <p className="text-[8px] font-black text-rose-300 uppercase tracking-widest mb-1">Deductions</p>
                         <p className="text-xs font-bold text-rose-500">₹{record.deductions.toLocaleString()}</p>
                       </div>
                       {record.status === "Pending" && (
                         <button 
                          onClick={() => handleMarkPaid(record._id)}
                          className="col-span-2 md:col-span-1 bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition shadow-lg shadow-indigo-100"
                         >
                           Pay Now
                         </button>
                       )}
                       {record.status === "Paid" && record.zohoExpenseId && (
                         <div className="col-span-2 md:col-span-1 flex flex-col items-end">
                           <p className="text-[7px] font-black text-slate-400 uppercase">Zoho Ref</p>
                           <p className="text-[9px] font-bold text-indigo-500">#{record.zohoExpenseId}</p>
                         </div>
                       )}
                    </div>
                  </div>
                ))
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default PayrollPage;
