import React, { useState, useEffect } from "react";
import { 
  FaTicketAlt, FaTimes, FaUser, FaBox, FaChevronRight, 
  FaCheckCircle, FaPlay, FaCopy, FaExternalLinkAlt 
} from "react-icons/fa";
import { API_BASE, fetchWithAuth } from "../../api";
import { toast } from "react-toastify";

const TokenSidePanel = ({ branchId, user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [referenceToken, setReferenceToken] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchActiveTokens();
    }
  }, [isOpen]);

  const fetchActiveTokens = async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth(`${API_BASE}/tokens/branch/${branchId}`);
      const data = await res.json();
      if (data.success) {
        setTokens(data.data);
      }
    } catch (err) {
      toast.error("Failed to load tokens");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/tokens/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, takenBy: user?.id })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Status updated to ${status}`);
        fetchActiveTokens();
        // If finished, close reference if it was this token
        if (status === "FINISHED" && referenceToken?._id === id) {
          setReferenceToken(null);
        }
      }
    } catch (err) {
      toast.error("Status update failed");
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-[60] bg-indigo-600 text-white p-3 pr-4 rounded-l-2xl shadow-2xl flex items-center gap-2 hover:bg-indigo-700 transition-all hover:-translate-x-1 group"
      >
        <FaTicketAlt className="text-xl animate-pulse" />
        <span className="font-black text-[10px] uppercase tracking-widest hidden group-hover:block transition-all">Open Tokens</span>
      </button>

      {/* Side Panel Drawer */}
      <div className={`fixed inset-y-0 right-0 w-80 md:w-96 bg-white z-[70] shadow-[-10px_0_30px_rgba(0,0,0,0.1)] transition-transform duration-500 ease-in-out transform ${isOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
        {/* Header */}
        <div className="bg-slate-900 p-6 flex justify-between items-center text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center">
              <FaTicketAlt />
            </div>
            <div>
              <h3 className="font-black text-sm uppercase tracking-tight">Active Tokens</h3>
              <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">{tokens.length} Pending</p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-white/40 hover:text-white transition-colors">
            <FaTimes size={20} />
          </button>
        </div>

        {/* Token List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-50">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-[10px] font-black uppercase tracking-widest">Loading...</p>
            </div>
          ) : tokens.length === 0 ? (
            <div className="text-center py-20">
              <FaTicketAlt className="text-slate-200 text-4xl mx-auto mb-4" />
              <p className="text-slate-400 font-bold text-sm uppercase">No active tokens</p>
            </div>
          ) : (
            tokens.map(token => (
              <div key={token._id} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-100 group">
                <div className="flex justify-between items-start mb-3">
                  <span className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[9px] font-black uppercase tracking-widest">
                    {token.tokenId}
                  </span>
                  <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${
                    token.status === 'OPEN' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                  }`}>
                    {token.status}
                  </div>
                </div>

                <h4 className="font-black text-slate-800 text-sm mb-1">{token.customer?.name}</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase mb-4 flex items-center gap-2">
                  <FaUser className="text-[8px]" /> Assigned: {token.assignedTo?.name}
                </p>

                <div className="flex flex-wrap gap-2 mb-4">
                  <button 
                    onClick={() => setReferenceToken(token)}
                    className="flex-1 bg-white border border-slate-200 text-slate-600 p-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-indigo-500 hover:text-indigo-600 transition flex items-center justify-center gap-1.5"
                  >
                    <FaExternalLinkAlt size={8} /> View Data
                  </button>
                  {token.status === 'OPEN' ? (
                    <button 
                      onClick={() => updateStatus(token._id, 'TAKEN')}
                      className="flex-1 bg-indigo-600 text-white p-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition shadow-lg shadow-indigo-100"
                    >
                      Take
                    </button>
                  ) : (
                    <button 
                      onClick={() => updateStatus(token._id, 'FINISHED')}
                      className="flex-1 bg-emerald-600 text-white p-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition"
                    >
                      Finish
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Footer info */}
        <div className="p-4 border-t border-slate-50 bg-slate-50/50">
          <p className="text-[9px] font-bold text-slate-400 text-center uppercase tracking-widest">
            Pearls ERP Token Workflow v1.0
          </p>
        </div>
      </div>

      {/* Manual Reference Panel (Floating / Sticky) */}
      {referenceToken && (
        <div className="fixed top-24 right-96 z-[80] transition-all animate-in fade-in slide-in-from-right-4 duration-500">
          <div className="bg-white w-72 rounded-3xl shadow-2xl border-2 border-indigo-500 overflow-hidden">
            <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FaCopy />
                <h4 className="font-black text-xs uppercase tracking-tight">Reference Data</h4>
              </div>
              <button onClick={() => setReferenceToken(null)} className="text-white/60 hover:text-white">
                <FaTimes size={14} />
              </button>
            </div>
            
            <div className="p-5 space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Token ID</p>
                <p className="text-xs font-black text-indigo-600">{referenceToken.tokenId}</p>
              </div>
              
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Customer Name</p>
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg group">
                  <p className="text-xs font-black text-slate-700 select-all uppercase">{referenceToken.customer?.name}</p>
                  <button onClick={() => { navigator.clipboard.writeText(referenceToken.customer?.name); toast.info("Copied Name"); }} className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <FaCopy size={10} className="text-slate-400" />
                  </button>
                </div>
              </div>

              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Order Items (Manual Entry)</p>
                <div className="space-y-2">
                  {referenceToken.items?.map((item, idx) => (
                    <div key={idx} className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 group border-dashed">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight select-all">{item.name}</span>
                        <span className="text-[11px] font-black text-indigo-700">x{item.qty}</span>
                      </div>
                      <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => { navigator.clipboard.writeText(item.name); toast.info(`Copied ${item.name}`); }} className="text-[9px] font-bold text-indigo-500 hover:text-indigo-700 flex items-center gap-1 uppercase tracking-tighter">
                          <FaCopy size={8} /> Copy
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-center">
              <button 
                 onClick={() => updateStatus(referenceToken._id, "FINISHED")}
                 className="w-full bg-emerald-600 text-white p-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
              >
                <FaCheckCircle /> Mark token as finished
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TokenSidePanel;
