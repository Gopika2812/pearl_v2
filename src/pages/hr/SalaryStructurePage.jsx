import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { FaFileContract, FaSave, FaUser } from "react-icons/fa";
import { fetchWithAuth, API_BASE } from "../../api";
import { useBranch } from "../../context/BranchContext";

const SalaryStructurePage = () => {
  const { currentBranch, user } = useBranch();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [structure, setStructure] = useState({
    basicSalary: 0,
    overtimeRate: 0,
    bonus: 0,
    deductions: 0,
    shiftStartTime: "09:00",
    shiftEndTime: "18:00",
    allowedMonthlyLeaves: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployees();
  }, [currentBranch]);

  const fetchEmployees = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/hr/employees/list?branchId=${currentBranch?._id}`);
      const data = await res.json();
      if (data.success) {
        setEmployees(data.data);
      }
    } catch (err) {
      toast.error("Failed to fetch employees");
    } finally {
      setLoading(false);
    }
  };

  const fetchStructure = async (employeeId) => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/hr/payroll/structure/${employeeId}`);
      const data = await res.json();
      if (data.success && data.data) {
        setStructure(data.data);
      } else {
        setStructure({ basicSalary: 0, overtimeRate: 0, bonus: 0, deductions: 0, shiftStartTime: "09:00", shiftEndTime: "18:00", allowedMonthlyLeaves: 0 });
      }
    } catch (err) {
      toast.error("Failed to fetch salary structure");
    }
  };

  const handleSelectEmployee = (emp) => {
    setSelectedEmployee(emp);
    fetchStructure(emp._id);
  };

  const handleSave = async () => {
    if (!selectedEmployee) return;
    try {
      const res = await fetchWithAuth(`${API_BASE}/hr/payroll/structure`, {
        method: "POST",
        body: JSON.stringify({
          employeeId: selectedEmployee._id,
          ...structure,
          branchId: currentBranch?._id
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Salary structure saved successfully");
      }
    } catch (err) {
      toast.error("Failed to save structure");
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm animate-in fade-in duration-500">
        <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-6 border border-rose-100">
          <FaUser className="text-3xl text-rose-400" />
        </div>
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Access Denied</h2>
        <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-2 max-w-xs">
          Only Super Admin has permission to modify salary configurations.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Salary Configuration</h1>
          <p className="text-slate-500 text-sm font-medium uppercase tracking-widest">Define base pay and allowances for employees</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <div className="lg:col-span-1 space-y-4">
           <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
             <span className="w-6 h-[2px] bg-indigo-500"></span> Select Employee
           </h2>
           <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 p-2 shadow-sm max-h-[40vh] lg:max-h-[70vh] overflow-y-auto no-scrollbar">
              {employees.map(emp => (
                <button 
                  key={emp._id}
                  onClick={() => handleSelectEmployee(emp)}
                  className={`w-full flex items-center gap-3 p-3 md:p-4 rounded-xl md:rounded-2xl transition-all ${
                    selectedEmployee?._id === emp._id ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center text-xs md:text-sm ${selectedEmployee?._id === emp._id ? "bg-white/20 text-white" : "bg-indigo-50 text-indigo-500"}`}>
                    <FaUser />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] md:text-xs font-black uppercase leading-tight">{emp.name}</p>
                      <span className={`text-[7px] md:text-[8px] font-black px-1 rounded uppercase ${selectedEmployee?._id === emp._id ? "bg-white/20 text-white" : "bg-indigo-50 text-indigo-500"}`}>#{emp.employeeCode}</span>
                    </div>
                    <p className={`text-[8px] md:text-[9px] font-bold uppercase tracking-widest ${selectedEmployee?._id === emp._id ? "text-indigo-100" : "text-slate-400"}`}>{emp.role}</p>
                  </div>
                </button>
              ))}
           </div>
        </div>

        <div className="lg:col-span-2">
           {!selectedEmployee ? (
             <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] border border-dashed border-slate-200 p-10 md:p-20 text-center flex flex-col items-center">
                <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 text-slate-200">
                  <FaFileContract className="text-2xl md:text-3xl" />
                </div>
                <h3 className="text-slate-400 font-black uppercase text-[10px] md:text-sm tracking-widest">Select an employee to view structure</h3>
             </div>
           ) : (
             <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200 p-5 md:p-8 shadow-sm space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-4 border-b border-slate-100 pb-4 md:pb-6">
                   <div className="w-12 h-12 md:w-14 md:h-14 bg-indigo-50 rounded-xl md:rounded-2xl flex items-center justify-center text-indigo-500">
                     <FaUser className="text-xl md:text-2xl" />
                   </div>
                   <div>
                     <h2 className="text-lg md:text-xl font-black text-slate-800 uppercase tracking-tight">{selectedEmployee.name}</h2>
                     <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest">Salary Configuration Panel</p>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                   <div className="space-y-2">
                      <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Monthly Basic Salary</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                        <input 
                          type="number"
                          value={structure.basicSalary}
                          onChange={(e) => setStructure({...structure, basicSalary: parseFloat(e.target.value) || 0})}
                          className="w-full bg-slate-50 border-none rounded-xl md:rounded-2xl py-3 md:py-4 pl-10 pr-4 text-xs md:text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-100 transition-all"
                          placeholder="0.00"
                        />
                      </div>
                   </div>

                   <div className="space-y-2">
                      <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Overtime Rate (Per Hour)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                        <input 
                          type="number"
                          value={structure.overtimeRate}
                          onChange={(e) => setStructure({...structure, overtimeRate: parseFloat(e.target.value) || 0})}
                          className="w-full bg-slate-50 border-none rounded-xl md:rounded-2xl py-3 md:py-4 pl-10 pr-4 text-xs md:text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-100 transition-all"
                          placeholder="0.00"
                        />
                      </div>
                   </div>

                   <div className="space-y-2">
                      <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Recurring Bonus / Allowances</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                        <input 
                          type="number"
                          value={structure.bonus}
                          onChange={(e) => setStructure({...structure, bonus: parseFloat(e.target.value) || 0})}
                          className="w-full bg-slate-50 border-none rounded-xl md:rounded-2xl py-3 md:py-4 pl-10 pr-4 text-xs md:text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-100 transition-all"
                          placeholder="0.00"
                        />
                      </div>
                   </div>

                    <div className="space-y-2">
                       <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Standard Deductions (Tax/PF)</label>
                       <div className="relative">
                         <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                         <input 
                           type="number"
                           value={structure.deductions}
                           onChange={(e) => setStructure({...structure, deductions: parseFloat(e.target.value) || 0})}
                           className="w-full bg-slate-50 border-none rounded-xl md:rounded-2xl py-3 md:py-4 pl-10 pr-4 text-xs md:text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-100 transition-all text-rose-500"
                           placeholder="0.00"
                         />
                       </div>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Shift Start Time</label>
                       <input 
                         type="time"
                         value={structure.shiftStartTime || "09:00"}
                         onChange={(e) => setStructure({...structure, shiftStartTime: e.target.value})}
                         className="w-full bg-slate-50 border-none rounded-xl md:rounded-2xl py-3 md:py-4 px-4 text-xs md:text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-100 transition-all"
                       />
                    </div>

                    <div className="space-y-2">
                       <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Shift End Time</label>
                       <input 
                         type="time"
                         value={structure.shiftEndTime || "18:00"}
                         onChange={(e) => setStructure({...structure, shiftEndTime: e.target.value})}
                         className="w-full bg-slate-50 border-none rounded-xl md:rounded-2xl py-3 md:py-4 px-4 text-xs md:text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-100 transition-all"
                       />
                    </div>

                    <div className="space-y-2">
                       <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Allowed Monthly Leaves</label>
                       <input 
                         type="number"
                         value={structure.allowedMonthlyLeaves || 0}
                         onChange={(e) => setStructure({...structure, allowedMonthlyLeaves: parseInt(e.target.value) || 0})}
                         className="w-full bg-slate-50 border-none rounded-xl md:rounded-2xl py-3 md:py-4 px-4 text-xs md:text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-100 transition-all"
                         placeholder="0"
                       />
                    </div>
                 </div>

                <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                   <div className="text-center sm:text-left w-full sm:w-auto">
                     <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Estimated Monthly Net Pay</p>
                     <p className="text-xl md:text-2xl font-black text-emerald-500 tracking-tighter">₹{(structure.basicSalary + structure.bonus - structure.deductions).toLocaleString()}</p>
                   </div>
                   <button 
                    onClick={handleSave}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 text-white px-8 py-3 md:py-4 rounded-xl md:rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition shadow-xl shadow-indigo-100 active:scale-95"
                   >
                     <FaSave /> Save Configuration
                   </button>
                </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default SalaryStructurePage;
