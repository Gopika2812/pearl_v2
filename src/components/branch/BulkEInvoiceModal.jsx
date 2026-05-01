import React, { useState } from "react";
import { FaTimes, FaSync, FaExclamationTriangle, FaCheckCircle, FaCalendarAlt } from "react-icons/fa";
import { API_BASE, fetchWithAuth } from "../../api";
import { toast } from "react-toastify";
import { useBranch } from "../../context/BranchContext";

const BulkEInvoiceModal = ({ show, onClose, onRefresh }) => {
  if (!show) return null;

  const { currentBranch, user } = useBranch();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  const [validating, setValidating] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  const [validationResult, setValidationResult] = useState(null);
  const [activeTab, setActiveTab] = useState('ready'); // 'ready' or 'errors'

  const handleValidate = async () => {
    if (!currentBranch?._id) return;
    setValidating(true);
    setValidationResult(null);
    try {
      const res = await fetchWithAuth(`${API_BASE}/einvoice/bulk-validate`, {
        method: 'POST',
        body: JSON.stringify({
          branchId: currentBranch._id,
          month: selectedMonth,
          year: selectedYear
        })
      });
      const data = await res.json();
      if (data.success) {
        setValidationResult(data.data);
        if (data.data.errors.length > 0) {
          setActiveTab('errors');
        } else {
          setActiveTab('ready');
        }
      } else {
        toast.error(data.message || "Validation failed");
      }
    } catch (err) {
      toast.error("Error connecting to server");
    } finally {
      setValidating(false);
    }
  };

  const handleGenerate = async () => {
    if (!validationResult || validationResult.ready.length === 0) return;
    if (!window.confirm(`Are you sure you want to generate ${validationResult.ready.length} E-Invoices?`)) return;

    setGenerating(true);
    const invoiceIds = validationResult.ready.map(i => i.invoiceId);
    
    try {
      const res = await fetchWithAuth(`${API_BASE}/einvoice/bulk-generate`, {
        method: 'POST',
        body: JSON.stringify({
          invoiceIds,
          userId: user?._id || user?.id,
          username: user?.username || user?.fullName || "Staff"
        })
      });
      const data = await res.json();
      if (data.success) {
        const successCount = data.results.filter(r => r.success).length;
        const failCount = data.results.filter(r => !r.success).length;
        
        toast.success(`Generated ${successCount} successfully! ${failCount > 0 ? `${failCount} failed.` : ''}`);
        onRefresh();
        onClose();
      } else {
        toast.error(data.message || "Bulk generation failed");
      }
    } catch (err) {
      toast.error("Error connecting to server");
    } finally {
      setGenerating(false);
    }
  };

  const months = [
    { value: 1, label: "January" }, { value: 2, label: "February" }, { value: 3, label: "March" },
    { value: 4, label: "April" }, { value: 5, label: "May" }, { value: 6, label: "June" },
    { value: 7, label: "July" }, { value: 8, label: "August" }, { value: 9, label: "September" },
    { value: 10, label: "October" }, { value: 11, label: "November" }, { value: 12, label: "December" }
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-indigo-600 p-6 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <FaSync size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">Month End E-Invoice Generation</h2>
              <p className="text-[10px] opacity-80 font-bold uppercase tracking-widest">Validate & Generate Bulk IRNs</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition text-white">
            <FaTimes />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto">
          {/* Month Selector */}
          <div className="flex items-end gap-4 mb-8 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="flex-1">
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Select Month</label>
              <select 
                value={selectedMonth} 
                onChange={e => setSelectedMonth(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-indigo-500 outline-none"
              >
                {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Select Year</label>
              <input 
                type="number" 
                value={selectedYear} 
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-indigo-500 outline-none"
              />
            </div>
            <button 
              onClick={handleValidate}
              disabled={validating}
              className="px-6 py-3 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 transition flex items-center gap-2 h-[46px]"
            >
              {validating ? <FaSync className="animate-spin" /> : <FaCheckCircle />}
              Validate Month
            </button>
          </div>

          {validationResult && (
            <div className="flex flex-col gap-4">
              {/* Tabs */}
              <div className="flex gap-2 p-1 bg-slate-100 rounded-xl shrink-0">
                <button
                  onClick={() => setActiveTab('ready')}
                  className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition ${
                    activeTab === 'ready' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  Ready to Generate ({validationResult.ready.length})
                </button>
                <button
                  onClick={() => setActiveTab('errors')}
                  className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition ${
                    activeTab === 'errors' ? "bg-white text-rose-600 shadow-sm" : "text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  Action Required ({validationResult.errors.length})
                </button>
              </div>

              {/* Tab Content */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 min-h-[250px] max-h-[400px] overflow-y-auto">
                {activeTab === 'errors' ? (
                  validationResult.errors.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 font-bold">No errors found! All invoices are ready.</div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {validationResult.errors.map((inv, idx) => (
                        <div key={idx} className="bg-white border border-rose-200 p-4 rounded-xl shadow-sm">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-black text-rose-600 text-sm">{inv.invoiceNumber}</span>
                            <span className="text-xs font-bold text-slate-500">{inv.customerName} | ₹{inv.grandTotal}</span>
                          </div>
                          <ul className="list-disc pl-5 text-xs font-semibold text-rose-500 space-y-1">
                            {inv.errors.map((err, eIdx) => <li key={eIdx}>{err}</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  validationResult.ready.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 font-bold">No valid invoices found for this month.</div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {validationResult.ready.map((inv, idx) => (
                        <div key={idx} className="bg-white border border-emerald-200 p-3 rounded-xl shadow-sm flex flex-col">
                          <span className="font-black text-emerald-600 text-xs">{inv.invoiceNumber}</span>
                          <span className="text-[10px] font-bold text-slate-500 mt-1 truncate">{inv.customerName}</span>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-between shrink-0 rounded-b-[32px]">
          <span className="text-xs font-bold text-slate-400 self-center">
            {validationResult ? `Total Registered Invoices Found: ${validationResult.totalFound}` : "Click Validate to scan invoices"}
          </span>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-6 py-3 rounded-xl font-black text-slate-500 hover:bg-slate-200 transition text-sm">Cancel</button>
            <button 
              onClick={handleGenerate}
              disabled={!validationResult || validationResult.ready.length === 0 || generating}
              className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-black shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition flex items-center gap-2 text-sm disabled:opacity-50 disabled:shadow-none"
            >
              {generating ? <FaSync className="animate-spin" /> : <FaCheckCircle />}
              Generate Valid Invoices ({validationResult ? validationResult.ready.length : 0})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkEInvoiceModal;
