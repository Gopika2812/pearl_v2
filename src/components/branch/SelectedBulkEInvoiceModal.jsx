import React, { useState } from "react";
import { FaTimes, FaSync, FaCheckCircle } from "react-icons/fa";
import { API_BASE, fetchWithAuth } from "../../api";
import { toast } from "react-toastify";
import { useBranch } from "../../context/BranchContext";

const SelectedBulkEInvoiceModal = ({ show, onClose, onRefresh, selectedInvoicesData }) => {
  if (!show) return null;

  const { user } = useBranch();
  const [generating, setGenerating] = useState(false);
  const [generationResults, setGenerationResults] = useState(null);
  const [activeTab, setActiveTab] = useState('ready'); // 'ready' or 'results'

  const validInvoices = selectedInvoicesData.filter(inv => inv.einvoiceStatus !== "GENERATED" && !inv.isDummy);

  const handleGenerate = async () => {
    if (validInvoices.length === 0) return;
    if (!window.confirm(`Are you sure you want to generate ${validInvoices.length} E-Invoices?`)) return;

    setGenerating(true);
    const invoiceIds = validInvoices.map(i => i._id);
    
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
        setGenerationResults(data.results);
        onRefresh(); // Refresh table data
        setActiveTab('results');
      } else {
        toast.error(data.message || "Bulk generation failed");
      }
    } catch (err) {
      toast.error("Error connecting to server");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-blue-600 p-6 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <FaCheckCircle size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">Consolidate E-Invoice Generation</h2>
              <p className="text-[10px] opacity-80 font-bold uppercase tracking-widest">Generate IRNs for {selectedInvoicesData.length} selected invoices</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition text-white">
            <FaTimes />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4">
            {/* Tabs */}
            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl shrink-0">
              <button
                onClick={() => setActiveTab('ready')}
                className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition ${
                  activeTab === 'ready' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:bg-slate-200"
                }`}
              >
                Selected Invoices ({validInvoices.length})
              </button>
              {generationResults && (
                <button
                  onClick={() => setActiveTab('results')}
                  className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition ${
                    activeTab === 'results' ? "bg-white text-amber-600 shadow-sm" : "text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  Gen. Results ({generationResults.length})
                </button>
              )}
            </div>

            {/* Tab Content */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 min-h-[250px] max-h-[400px] overflow-y-auto">
              {activeTab === 'results' ? (
                <div className="flex flex-col gap-3">
                  {generationResults?.map((res, idx) => (
                    <div key={idx} className={`p-4 rounded-xl shadow-sm border ${res.success ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"}`}>
                      <div className="flex justify-between items-center">
                        <span className={`font-black text-sm ${res.success ? "text-emerald-700" : "text-rose-700"}`}>
                          {res.invoiceNumber || res.invoiceId}
                        </span>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${res.success ? "bg-emerald-200 text-emerald-800" : "bg-rose-200 text-rose-800"}`}>
                          {res.success ? "SUCCESS" : "FAILED"}
                        </span>
                      </div>
                      {!res.success && (
                        <p className="text-xs font-bold text-rose-600 mt-2 leading-relaxed">
                          Error: {res.message}
                        </p>
                      )}
                      {res.success && (
                        <p className="text-[10px] font-bold text-emerald-600 mt-1">IRN Generated Successfully</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                validInvoices.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 font-bold text-center">
                    No valid invoices found to generate.<br/>(Already generated or Dummy Bills are skipped)
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {validInvoices.map((inv, idx) => (
                      <div key={idx} className="bg-white border border-blue-200 p-3 rounded-xl shadow-sm flex flex-col">
                        <span className="font-black text-blue-600 text-xs">{inv.invoiceNumber}</span>
                        <span className="text-[10px] font-bold text-slate-500 mt-1 truncate">{inv.customer?.name || "Cash Customer"}</span>
                        <span className="text-[10px] font-bold text-slate-400 mt-0.5">₹{inv.grandTotal}</span>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end shrink-0 rounded-b-[32px] gap-3">
          <button onClick={onClose} className="px-6 py-3 rounded-xl font-black text-slate-500 hover:bg-slate-200 transition text-sm">Close</button>
          {activeTab === 'ready' && (
            <button 
              onClick={handleGenerate}
              disabled={validInvoices.length === 0 || generating}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black shadow-lg shadow-blue-200 hover:bg-blue-700 transition flex items-center gap-2 text-sm disabled:opacity-50 disabled:shadow-none"
            >
              {generating ? <FaSync className="animate-spin" /> : <FaCheckCircle />}
              Generate ({validInvoices.length})
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SelectedBulkEInvoiceModal;
