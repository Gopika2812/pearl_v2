import React, { useState, useEffect, useRef } from "react";
import { useBranch } from "../../context/BranchContext";
import { API_BASE } from "../../api";
import { 
  FaPlus, FaUpload, FaSearch, FaFilter, FaBook, 
  FaInfoCircle, FaFileExcel, FaChartPie, FaMoneyBillWave 
} from "react-icons/fa";
import { toast } from "react-toastify";
import LedgerModal from "../../components/accounts/LedgerModal";

const BranchLedger = () => {
  const { currentBranch } = useBranch();
  const branchId = currentBranch?._id || currentBranch?.id;
  
  const [loading, setLoading] = useState(true);
  const [ledgers, setLedgers] = useState([]);
  const [filteredLedgers, setFilteredLedgers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const fileInputRef = useRef(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [groupFilter, setGroupFilter] = useState("All");
  const [natureFilter, setNatureFilter] = useState("All");

  useEffect(() => {
    if (branchId) {
      fetchData();
    }
  }, [branchId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const [ledgerRes, groupRes] = await Promise.all([
        fetch(`${API_BASE}/ledgers?branchId=${branchId}`, {
          headers: { "Authorization": `Bearer ${token}` }
        }),
        fetch(`${API_BASE}/ledgers/groups?branchId=${branchId}`, {
          headers: { "Authorization": `Bearer ${token}` }
        })
      ]);

      const ledgerData = await ledgerRes.json();

      const groupData = await groupRes.json();

      setLedgers(ledgerData);
      setFilteredLedgers(ledgerData);
      setGroups(groupData);
    } catch (err) {
      console.error("Error fetching data:", err);
      toast.error("Failed to load ledger data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = [...ledgers];

    if (groupFilter !== "All") {
      filtered = filtered.filter(l => l.groupId?._id === groupFilter);
    }

    if (natureFilter !== "All") {
      filtered = filtered.filter(l => l.groupId?.nature === natureFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(l => 
        l.name.toLowerCase().includes(term) ||
        l.groupId?.name.toLowerCase().includes(term) ||
        (l.gstin && l.gstin.toLowerCase().includes(term))
      );
    }

    setFilteredLedgers(filtered);
  }, [searchTerm, groupFilter, natureFilter, ledgers]);

  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("branchId", branchId);

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/ledgers/bulk-upload`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData,
      });
      const result = await response.json();


      if (result.success) {
        toast.success(result.message);
        fetchData();
      } else {
        toast.error(result.message || "Bulk upload failed");
      }
    } catch (err) {
      toast.error("Error uploading file");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Stats
  const totalDebit = filteredLedgers.reduce((sum, l) => sum + (l.openingDebit || 0), 0);
  const totalCredit = filteredLedgers.reduce((sum, l) => sum + (l.openingCredit || 0), 0);

  const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#319bab] outline-none text-sm transition-all";
  const labelClass = "block text-[10px] font-bold text-gray-500 uppercase mb-1 tracking-wider";

  return (
    <div className="space-y-6">
      {/* PREMIUM HEADER SECTION */}
      <div className="relative overflow-hidden bg-white/50 backdrop-blur-sm p-8 rounded-3xl border border-white/50 shadow-sm mb-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl"></div>
        
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-emerald-500/20">
              <FaBook size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded-md">Finance Hub</span>
                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">v3.5 Active</span>
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none uppercase italic">
                Ledger <span className="text-emerald-600 not-italic">Management</span>
              </h1>
              <p className="text-slate-500 text-sm font-semibold mt-1">Multi-branch data isolation & adaptive bulk migration engine</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleBulkUpload}
              className="hidden"
              accept=".xlsx, .xls, .csv"
            />
            <button
              onClick={() => fileInputRef.current.click()}
              className="group flex items-center gap-3 bg-white border border-slate-200 text-slate-700 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all shadow-xl shadow-slate-200/50 hover:-translate-y-0.5 active:translate-y-0"
            >
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                <FaUpload />
              </div>
              Bulk Upload
            </button>

            <button
              onClick={() => setIsModalOpen(true)}
              className="group flex items-center gap-3 bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 hover:-translate-y-0.5 active:translate-y-0"
            >
              <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-white group-hover:bg-white/20 transition-colors border border-white/10">
                <FaPlus />
              </div>
              Create Ledger
            </button>
          </div>
        </div>
      </div>

      {/* MODERN QUICK STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="relative group overflow-hidden bg-white p-7 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full translate-x-1/2 -translate-y-1/2 blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
          <div className="relative flex items-center gap-5">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <FaMoneyBillWave size={22} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Total Opening Debit</p>
              <p className="text-2xl font-black text-slate-900 tracking-tight leading-none">₹{totalDebit.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="relative group overflow-hidden bg-white p-7 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full translate-x-1/2 -translate-y-1/2 blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
          <div className="relative flex items-center gap-5">
            <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
              <FaMoneyBillWave size={22} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Total Opening Credit</p>
              <p className="text-2xl font-black text-slate-900 tracking-tight leading-none">₹{totalCredit.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className={`relative group overflow-hidden bg-white p-7 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-xl transition-all duration-500 hover:-translate-y-1 ${totalDebit - totalCredit >= 0 ? "border-l-4 border-emerald-500" : "border-l-4 border-rose-500"}`}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full translate-x-1/2 -translate-y-1/2 blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
          <div className="relative flex items-center gap-5">
            <div className={`w-14 h-14 bg-gradient-to-br ${totalDebit - totalCredit >= 0 ? "from-emerald-500 to-teal-600" : "from-rose-500 to-red-600"} rounded-2xl flex items-center justify-center text-white shadow-lg ${totalDebit - totalCredit >= 0 ? "shadow-emerald-500/20" : "shadow-rose-500/20"}`}>
              <FaChartPie size={22} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Net Opening Balance</p>
                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase border ${totalDebit - totalCredit >= 0 ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100"}`}>
                  {totalDebit - totalCredit >= 0 ? "Debit Heavy" : "Credit Heavy"}
                </span>
              </div>
              <p className={`text-2xl font-black tracking-tight leading-none ${totalDebit - totalCredit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                ₹{Math.abs(totalDebit - totalCredit).toLocaleString()} <span className="text-xs">{totalDebit - totalCredit >= 0 ? "Dr" : "Cr"}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* PREMIUM FILTER BAR */}
      <div className="bg-white/70 backdrop-blur-md p-2 rounded-[2rem] border border-white shadow-sm mb-8 flex flex-col md:flex-row items-center gap-2">
        <div className="flex-1 w-full relative group">
          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors">
            <FaSearch size={14} />
          </div>
          <input
            type="text"
            placeholder="Search by name, group, or GSTIN..."
            className="w-full bg-slate-50 border-none rounded-2xl px-12 py-4 focus:ring-2 focus:ring-emerald-500/20 outline-none text-[13px] font-bold text-slate-700 transition-all placeholder:text-slate-400 shadow-inner"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto p-1">
          <div className="relative min-w-[200px]">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <FaFilter size={12} />
            </div>
            <select
              className="w-full appearance-none bg-slate-50 border-none rounded-xl pl-10 pr-10 py-3 text-[12px] font-black uppercase text-slate-600 focus:ring-2 focus:ring-emerald-500/20 outline-none cursor-pointer transition-all shadow-inner"
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
            >
              <option value="All">All Groups</option>
              {groups.map(g => (
                <option key={g._id} value={g._id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div className="relative min-w-[180px]">
             <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <FaFilter size={12} />
            </div>
            <select
              className="w-full appearance-none bg-slate-50 border-none rounded-xl pl-10 pr-10 py-3 text-[12px] font-black uppercase text-slate-600 focus:ring-2 focus:ring-emerald-500/20 outline-none cursor-pointer transition-all shadow-inner"
              value={natureFilter}
              onChange={(e) => setNatureFilter(e.target.value)}
            >
              <option value="All">All Natures</option>
              <option value="Asset">Asset</option>
              <option value="Liability">Liability</option>
              <option value="Income">Income</option>
              <option value="Expense">Expense</option>
            </select>
          </div>
        </div>
      </div>

      {/* PREMIUM TABLE SECTION */}
      <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/60 border border-white overflow-hidden p-2">
        {loading ? (
          <div className="p-32 text-center bg-slate-50/50 rounded-[2rem]">
            <div className="w-16 h-16 border-4 border-slate-100 border-t-emerald-500 rounded-full animate-spin mx-auto mb-6"></div>
            <p className="text-slate-400 font-black uppercase text-[10px] tracking-[0.2em]">Synchronizing Ledgers...</p>
          </div>
        ) : filteredLedgers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900 text-slate-400 uppercase text-[10px] font-black tracking-widest">
                  <th className="px-8 py-6 text-left rounded-tl-[1.8rem]">Ledger Details</th>
                  <th className="px-6 py-6 text-left">Group Hierarchy</th>
                  <th className="px-6 py-6 text-left">Nature</th>
                  <th className="px-6 py-6 text-left">Tax Details</th>
                  <th className="px-6 py-6 text-right">Debit (Dr)</th>
                  <th className="px-6 py-6 text-right">Credit (Cr)</th>
                  <th className="px-8 py-6 text-right rounded-tr-[1.8rem]">Net Financial Position</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredLedgers.map((ledger) => {
                  const net = (ledger.openingDebit || 0) - (ledger.openingCredit || 0);
                  return (
                    <tr key={ledger._id} className="hover:bg-slate-50/80 transition-all duration-300 group cursor-default">
                      <td className="px-8 py-6">
                        <div className="font-black text-slate-800 text-[14px] group-hover:text-emerald-700 transition-colors">{ledger.name}</div>
                        {ledger.notes && (
                          <div className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-[200px] mt-1 tracking-wider italic">
                            {ledger.notes}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-6">
                        <span className="bg-slate-100 text-slate-500 px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider border border-slate-200/50 shadow-sm">
                          {ledger.groupId?.name || "Global Account"}
                        </span>
                      </td>
                      <td className="px-6 py-6">
                        <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider shadow-sm ${
                          ledger.groupId?.nature === "Asset" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                          ledger.groupId?.nature === "Liability" ? "bg-rose-50 text-rose-600 border border-rose-100" :
                          ledger.groupId?.nature === "Income" ? "bg-indigo-50 text-indigo-600 border border-indigo-100" :
                          "bg-amber-50 text-amber-600 border border-amber-100"
                        }`}>
                          {ledger.groupId?.nature || "Internal"}
                        </span>
                      </td>
                      <td className="px-6 py-6">
                         <div className="flex items-center gap-2 mb-1">
                            <span className="px-1.5 py-0.5 bg-slate-900 text-white text-[8px] font-black rounded uppercase">{ledger.gst}% GST</span>
                            <span className="text-[9px] font-black text-slate-600 truncate max-w-[100px]">{ledger.gstin || "-"}</span>
                         </div>
                         <div className="text-[9px] text-slate-400 font-bold tracking-widest uppercase">HSN: {ledger.hsn || "Not Req"}</div>
                      </td>
                      <td className="px-6 py-6 text-right">
                        <div className="text-[13px] font-bold text-slate-700">₹{ledger.openingDebit?.toLocaleString()}</div>
                      </td>
                      <td className="px-6 py-6 text-right">
                        <div className="text-[13px] font-bold text-slate-700">₹{ledger.openingCredit?.toLocaleString()}</div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className={`font-black text-[15px] tracking-tight ${net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          <span className="text-[10px] mr-1 opacity-50 uppercase">{net >= 0 ? "DR" : "CR"}</span>
                          ₹{Math.abs(net).toLocaleString()}
                        </div>
                        <div className={`h-1.5 w-full bg-slate-100 rounded-full mt-2 overflow-hidden`}>
                           <div className={`h-full rounded-full transition-all duration-1000 ${net >= 0 ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : "bg-rose-500 shadow-[0_0_8px_#f43f5e]"}`} style={{ width: '40%' }}></div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-20 text-center">
            <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaInfoCircle className="text-gray-300 text-4xl" />
            </div>
            <h3 className="text-gray-400 font-black uppercase text-sm tracking-widest">No ledgers found</h3>
            <p className="text-gray-400 text-xs mt-2">Try bulk uploading your data or create a manual ledger.</p>
          </div>
        )}
      </div>

      {/* LEDGER MODAL */}
      <LedgerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        branchId={branchId}
        onLedgerCreated={fetchData}
      />
    </div>
  );
};

export default BranchLedger;
