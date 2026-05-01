import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { FaFileContract, FaSave, FaUser } from "react-icons/fa";
import { fetchWithAuth, API_BASE } from "../../api";
import { useBranch } from "../../context/BranchContext";

const SalaryStructurePage = () => {
  const { currentBranch } = useBranch();
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [structure, setStructure] = useState({
    basicSalary: 0,
    overtimeRate: 0,
    bonus: 0,
    deductions: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployees();
  }, [currentBranch]);

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

  const fetchStructure = async (employeeId) => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/hr/payroll/structure/${employeeId}`);
      const data = await res.json();
      if (data.success && data.data) {
        setStructure(data.data);
      } else {
        setStructure({ basicSalary: 0, overtimeRate: 0, bonus: 0, deductions: 0 });
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Salary Configuration</h1>
          <p className="text-slate-500 text-sm font-medium uppercase tracking-widest">Define base pay and allowances for employees</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-4">
           <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
             <span className="w-6 h-[2px] bg-indigo-500"></span> Select Employee
           </h2>
           <div className="bg-white rounded-3xl border border-slate-200 p-2 shadow-sm max-h-[70vh] overflow-y-auto no-scrollbar">
              {employees.map(emp => (
                <button 
                  key={emp._id}
                  onClick={() => handleSelectEmployee(emp)}
                  className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${
                    selectedEmployee?._id === emp._id ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm ${selectedEmployee?._id === emp._id ? "bg-white/20 text-white" : "bg-indigo-50 text-indigo-500"}`}>
                    <FaUser />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-black uppercase leading-tight">{emp.name}</p>
                    <p className={`text-[9px] font-bold uppercase tracking-widest ${selectedEmployee?._id === emp._id ? "text-indigo-100" : "text-slate-400"}`}>{emp.role}</p>
                  </div>
                </button>
              ))}
           </div>
        </div>

        <div className="lg:col-span-2">
           {!selectedEmployee ? (
             <div className="bg-white rounded-[2.5rem] border border-dashed border-slate-200 p-20 text-center flex flex-col items-center">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 text-slate-200">
                  <FaFileContract className="text-3xl" />
                </div>
                <h3 className="text-slate-400 font-black uppercase text-sm tracking-widest">Select an employee to view structure</h3>
             </div>
           ) : (
             <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-4 border-b border-slate-100 pb-6">
                   <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500">
                     <FaUser className="text-2xl" />
                   </div>
                   <div>
                     <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">{selectedEmployee.name}</h2>
                     <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Salary Configuration Panel</p>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Monthly Basic Salary</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                        <input 
                          type="number"
                          value={structure.basicSalary}
                          onChange={(e) => setStructure({...structure, basicSalary: parseFloat(e.target.value) || 0})}
                          className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-10 pr-4 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-100 transition-all"
                          placeholder="0.00"
                        />
                      </div>
                   </div>

                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Overtime Rate (Per Hour)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                        <input 
                          type="number"
                          value={structure.overtimeRate}
                          onChange={(e) => setStructure({...structure, overtimeRate: parseFloat(e.target.value) || 0})}
                          className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-10 pr-4 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-100 transition-all"
                          placeholder="0.00"
                        />
                      </div>
                   </div>

                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Recurring Bonus / Allowances</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                        <input 
                          type="number"
                          value={structure.bonus}
                          onChange={(e) => setStructure({...structure, bonus: parseFloat(e.target.value) || 0})}
                          className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-10 pr-4 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-100 transition-all"
                          placeholder="0.00"
                        />
                      </div>
                   </div>

                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Standard Deductions (Tax/PF)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                        <input 
                          type="number"
                          value={structure.deductions}
                          onChange={(e) => setStructure({...structure, deductions: parseFloat(e.target.value) || 0})}
                          className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-10 pr-4 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-100 transition-all text-rose-500"
                          placeholder="0.00"
                        />
                      </div>
                   </div>
                </div>

                <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                   <div>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estimated Monthly Net Pay</p>
                     <p className="text-2xl font-black text-emerald-500 tracking-tighter">₹{(structure.basicSalary + structure.bonus - structure.deductions).toLocaleString()}</p>
                   </div>
                   <button 
                    onClick={handleSave}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition shadow-xl shadow-indigo-100"
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
