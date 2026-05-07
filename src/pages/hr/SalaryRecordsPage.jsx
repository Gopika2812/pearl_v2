import React, { useState, useEffect } from "react";
import { 
  FaMoneyBillWave, FaUser, FaSearch, FaFilter, FaDownload, 
  FaClock, FaCalendarCheck, FaBuilding, FaUserTie, FaEdit, FaHistory, FaTimes, FaSave
} from "react-icons/fa";
import { useBranch } from "../../context/BranchContext";
import { fetchWithAuth, API_BASE } from "../../api";
import { toast } from "react-toastify";

const SalaryRecordsPage = () => {
  const { currentBranch, user } = useBranch();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  
  const [structures, setStructures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editForm, setEditForm] = useState({
    basicSalary: 0,
    overtimeRate: 0,
    bonus: 0,
    deductions: 0,
    shiftStartTime: "09:00",
    shiftEndTime: "18:00",
    allowedMonthlyLeaves: 0
  });

  // History Modal State
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyList, setHistoryList] = useState([]);

  const fetchStructures = async () => {
    if (!currentBranch?._id) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/hr/payroll/structures?branchId=${currentBranch._id}`);
      const data = await res.json();
      if (data.success) {
        setStructures(data.data);
      }
    } catch (err) {
      toast.error("Failed to fetch salary records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchStructures();
    }
  }, [currentBranch]);

  const filteredStructures = structures.filter(s => 
    s.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.employeeCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditClick = (record) => {
    setEditingRecord(record);
    setEditForm({
      basicSalary: record.basicSalary || 0,
      overtimeRate: record.overtimeRate || 0,
      bonus: record.bonus || 0,
      deductions: record.deductions || 0,
      shiftStartTime: record.shiftStartTime || "09:00",
      shiftEndTime: record.shiftEndTime || "18:00",
      allowedMonthlyLeaves: record.allowedMonthlyLeaves || 0
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/hr/payroll/structure`, {
        method: "POST",
        body: JSON.stringify({
          ...editForm,
          employeeId: editingRecord.employeeId?._id || editingRecord.employeeId,
          branchId: currentBranch._id
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Salary configuration updated successfully");
        setIsEditModalOpen(false);
        fetchStructures();
      } else {
        toast.error(data.message || "Failed to update configuration");
      }
    } catch (err) {
      toast.error("Error saving changes");
    }
  };

  const handleViewHistory = (history) => {
    setHistoryList(history || []);
    setIsHistoryModalOpen(true);
  };

  const exportToCSV = () => {
    if (!filteredStructures.length) return;
    
    const headers = [
      "Employee Code", "Name", "Role", "Basic Salary", 
      "Overtime Rate/Hr", "Standard Bonus", "Standard Deductions",
      "Shift Start", "Shift End", "Monthly Allowed Leaves"
    ];

    const rows = filteredStructures.map(s => [
      s.employeeCode,
      s.employeeName,
      s.employeeRole,
      s.basicSalary,
      s.overtimeRate,
      s.bonus,
      s.deductions,
      s.shiftStartTime || "09:00",
      s.shiftEndTime || "18:00",
      s.allowedMonthlyLeaves || 0
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Salary_Records_${currentBranch?.name || 'Branch'}.csv`);
    link.click();
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-6 border border-rose-100">
          <FaUserTie className="text-3xl text-rose-400" />
        </div>
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Access Denied</h2>
        <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-2 max-w-xs">
          Only Super Admin has permission to view global salary records.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight">Salary Configuration Records</h1>
          <p className="text-slate-500 text-sm font-medium uppercase tracking-widest mt-1">Global view of employee remuneration profiles</p>
        </div>
        <button 
          onClick={exportToCSV}
          className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-200"
        >
          <FaDownload /> Export Data
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
          <input 
            type="text"
            placeholder="Search by Employee Name or Code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-100 transition-all uppercase placeholder:normal-case"
          />
        </div>
        <div className="flex items-center gap-2 bg-indigo-50 px-6 py-4 rounded-2xl border border-indigo-100 min-w-[200px] justify-center">
          <FaBuilding className="text-indigo-500" />
          <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">{currentBranch?.name || "Global"}</span>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Employee</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Basic Salary</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">OT Rate</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Shift Info</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Deductions</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading Salary Database...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredStructures.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-8 py-20 text-center opacity-30">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No configurations found</p>
                  </td>
                </tr>
              ) : (
                filteredStructures.map((s) => (
                  <tr key={s._id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl flex items-center justify-center text-slate-500 font-black text-xs border border-white shadow-sm">
                          {s.employeeName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{s.employeeName}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{s.employeeCode} • {s.employeeRole}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-xs font-black text-slate-700">₹{s.basicSalary?.toLocaleString()}</p>
                      <p className="text-[9px] font-bold text-emerald-500 uppercase mt-1">Bonus: ₹{s.bonus}</p>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-xs font-black text-slate-700">₹{s.overtimeRate}/hr</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Aggregated OT</p>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-indigo-600">
                        <FaClock className="text-[10px]" />
                        <span className="text-xs font-black uppercase tracking-tighter">
                          {s.shiftStartTime || "09:00"} - {s.shiftEndTime || "18:00"}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-xs font-black text-rose-500">₹{s.deductions?.toLocaleString()}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Tax/PF/Misc</p>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleEditClick(s)}
                          className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                          title="Edit Configuration"
                        >
                          <FaEdit size={12} />
                        </button>
                        <button 
                          onClick={() => handleViewHistory(s.changeHistory)}
                          className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                          title="View Audit Logs"
                        >
                          <FaHistory size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
             <div className="bg-indigo-600 p-8 text-white flex justify-between items-center">
                <div>
                   <h2 className="text-2xl font-black uppercase tracking-tight">Edit Configuration</h2>
                   <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-widest mt-1">Adjusting salary for {editingRecord?.employeeName}</p>
                </div>
                <button onClick={() => setIsEditModalOpen(false)} className="bg-white/10 p-3 rounded-2xl hover:bg-white/20 transition">
                   <FaTimes />
                </button>
             </div>
             <div className="p-8 grid grid-cols-2 gap-6">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Basic Salary (₹)</label>
                   <input 
                     type="number"
                     className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-slate-700"
                     value={editForm.basicSalary}
                     onChange={(e) => setEditForm({...editForm, basicSalary: e.target.value})}
                   />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">OT Rate/Hr (₹)</label>
                   <input 
                     type="number"
                     className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-slate-700"
                     value={editForm.overtimeRate}
                     onChange={(e) => setEditForm({...editForm, overtimeRate: e.target.value})}
                   />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Standard Bonus (₹)</label>
                   <input 
                     type="number"
                     className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-slate-700"
                     value={editForm.bonus}
                     onChange={(e) => setEditForm({...editForm, bonus: e.target.value})}
                   />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Standard Deductions (₹)</label>
                   <input 
                     type="number"
                     className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-slate-700"
                     value={editForm.deductions}
                     onChange={(e) => setEditForm({...editForm, deductions: e.target.value})}
                   />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Shift Start</label>
                   <input 
                     type="time"
                     className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-slate-700"
                     value={editForm.shiftStartTime}
                     onChange={(e) => setEditForm({...editForm, shiftStartTime: e.target.value})}
                   />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Shift End</label>
                   <input 
                     type="time"
                     className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-slate-700"
                     value={editForm.shiftEndTime}
                     onChange={(e) => setEditForm({...editForm, shiftEndTime: e.target.value})}
                   />
                </div>
                <div className="col-span-2 flex justify-end gap-4 mt-4">
                   <button 
                     onClick={() => setIsEditModalOpen(false)}
                     className="px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition"
                   >
                     Cancel
                   </button>
                   <button 
                     onClick={handleSaveEdit}
                     className="flex items-center gap-2 bg-indigo-600 text-white px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition shadow-xl shadow-indigo-100"
                   >
                     <FaSave /> Save Changes
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in duration-300">
             <div className="bg-emerald-600 p-8 text-white flex justify-between items-center">
                <div>
                   <h2 className="text-2xl font-black uppercase tracking-tight">Audit Logs</h2>
                   <p className="text-emerald-100 text-[10px] font-bold uppercase tracking-widest mt-1">Change history for this configuration</p>
                </div>
                <button onClick={() => setIsHistoryModalOpen(false)} className="bg-white/10 p-3 rounded-2xl hover:bg-white/20 transition">
                   <FaTimes />
                </button>
             </div>
             <div className="p-8 max-h-[60vh] overflow-y-auto no-scrollbar">
                {historyList.length === 0 ? (
                  <div className="text-center py-12 opacity-30">
                     <FaHistory className="text-4xl mx-auto mb-4" />
                     <p className="text-[10px] font-black uppercase tracking-widest">No history recorded</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                     {historyList.slice().reverse().map((log, idx) => (
                       <div key={idx} className="relative pl-6 border-l-2 border-slate-100 pb-2">
                          <div className="absolute left-[-5px] top-0 w-2 h-2 bg-emerald-500 rounded-full"></div>
                          <div className="flex justify-between items-start mb-2">
                             <p className="text-[10px] font-black text-slate-800 uppercase">{log.changedByName}</p>
                             <p className="text-[8px] font-bold text-slate-400 uppercase">{new Date(log.timestamp).toLocaleString()}</p>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-2xl">
                             <p className="text-[10px] font-bold text-slate-600 leading-relaxed whitespace-pre-line">
                                {log.details.split(" | ").join("\n")}
                             </p>
                          </div>
                       </div>
                     ))}
                  </div>
                )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalaryRecordsPage;
