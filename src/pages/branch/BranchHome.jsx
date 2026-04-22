import { useState, useEffect } from "react";
import { FaHome, FaPhone, FaCalendarCheck, FaClock, FaTicketAlt, FaCheckCircle, FaInbox } from "react-icons/fa";
import { Link } from "react-router-dom";
import { useBranch } from "../../context/BranchContext";
import { API_BASE, fetchWithAuth } from "../../api";

export default function BranchHome() {
  const { branch, user, currentBranch } = useBranch();
  const [tokens, setTokens] = useState([]);
  const [loadingTokens, setLoadingTokens] = useState(false);

  useEffect(() => {
    if (currentBranch?._id) {
      fetchMyTokens();
    }
  }, [currentBranch?._id]);

  const fetchMyTokens = async () => {
    setLoadingTokens(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/tokens/reminders/my`);
      const data = await res.json();
      if (data.success) {
        setTokens(data.data || []);
      }
    } catch (err) {
      console.error("Error fetching tokens:", err);
    } finally {
      setLoadingTokens(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 pt-20 md:pt-4 md:pl-20 px-4 md:px-6 pb-10">
      <div className="max-w-7xl mx-auto">
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-secondary to-primary text-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex items-start gap-4">
            <FaHome className="text-5xl opacity-80" />
            <div className="w-full">
              <h1 className="text-2xl font-bold mb-2">
                Welcome to {branch?.name}! 👋
              </h1>
              <p className="text-blue-100">
                Logged in as: <span className="font-bold">{user?.username}</span> ({user?.role})
              </p>
              <p className="text-blue-100">
                Location: <span className="font-bold">{branch?.location}</span>
              </p>
              <div className="mt-4">
                <Link
                  to="/branch/insights"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-secondary font-semibold hover:bg-blue-50 transition"
                >
                  View Insights
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Info Columns */}
          <div className="lg:col-span-2 space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">Branch Code</p>
                  <p className="text-xl font-black text-gray-800">{branch?.code || "-"}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">Phone</p>
                  <p className="text-xl font-black text-gray-800">{branch?.phone || "-"}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">Branch Manager</p>
                  <p className="text-xl font-black text-gray-800">{branch?.manager || "-"}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">Status</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-bold text-gray-700">Online & Synchronized</span>
                  </div>
                </div>
             </div>
             
             <div className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100">
               <h3 className="text-sm font-black text-gray-400 uppercase tracking-[2px] mb-4">Branch Address</h3>
               <p className="text-gray-600 font-medium leading-relaxed">{branch?.address || "No address configured"}</p>
             </div>
          </div>

          {/* Sticky Assigned Tokens */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden sticky top-8">
              <div className="bg-indigo-600 p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FaTicketAlt className="text-white text-xl" />
                  <h3 className="text-white font-black text-sm uppercase tracking-widest">Assigned Tokens</h3>
                </div>
                <div className="bg-white/20 px-2.5 py-1 rounded-lg text-white text-[10px] font-black">{tokens.length}</div>
              </div>
              
              <div className="p-4 max-h-[500px] overflow-y-auto space-y-3 no-scrollbar">
                {loadingTokens ? (
                   <div className="py-10 text-center animate-pulse text-gray-400 font-bold uppercase text-[10px] tracking-widest">Syncing Tokens...</div>
                ) : tokens.length === 0 ? (
                  <div className="py-12 text-center text-slate-100">
                    <div className="bg-gray-50 w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <FaInbox className="text-gray-300 text-xl" />
                    </div>
                    <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">No tokens assigned to you</p>
                  </div>
                ) : (
                  tokens.map(t => (
                    <Link 
                      to="/branch/tokenization" 
                      key={t._id}
                      className={`group flex flex-col p-4 rounded-2xl border transition-all duration-300 ${
                        t.status === "COMPLETED" 
                          ? "bg-emerald-50/50 border-emerald-100/50 opacity-80" 
                          : "bg-gray-50 border-transparent hover:border-indigo-100 hover:bg-indigo-50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-widest uppercase ${
                            t.status === "OPEN" ? "bg-amber-100 text-amber-700" :
                            t.status === "TAKEN" || t.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-700" :
                            t.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" :
                            "bg-gray-100 text-gray-700"
                          }`}>
                            {t.status?.replace("_", " ")}
                          </span>
                          <span className="text-[9px] font-black text-indigo-600/50 tracking-tighter uppercase">{t.tokenId}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[9px] font-bold text-gray-400 bg-white px-2 py-0.5 rounded-full shadow-sm">
                           <FaClock size={8} /> {new Date(t.createdAt).toLocaleDateString("en-IN", { day: '2-digit', month: 'short' })}
                        </div>
                      </div>
                      <h4 className={`text-sm font-black tracking-tight transition-colors uppercase truncate ${
                        t.status === "COMPLETED" ? "text-emerald-800/60 line-through" : "text-gray-800 group-hover:text-indigo-700"
                      }`}>
                        {t.customer?.name || "Internal Task"}
                      </h4>
                      <p className={`text-[10px] font-medium mt-1 italic line-clamp-2 ${
                        t.status === "COMPLETED" ? "text-emerald-600/40" : "text-gray-500"
                      }`}>"{t.message}"</p>
                      
                      <div className="mt-3 flex items-center justify-between pt-3 border-t border-gray-200/50">
                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">
                           Created: {new Date(t.createdAt).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </span>
                        {t.status === "COMPLETED" ? (
                           <FaCheckCircle className="text-emerald-500" size={14} />
                        ) : (
                          <div className="w-6 h-6 bg-indigo-600 rounded-lg flex items-center justify-center text-white scale-0 group-hover:scale-100 transition-transform shadow-lg shadow-indigo-600/20">
                             <FaTicketAlt size={10} />
                          </div>
                        )}
                      </div>
                    </Link>
                  ))
                )}
              </div>

              <div className="p-4 border-t border-gray-50 bg-gray-50/50">
                <Link to="/branch/tokenization" className="block text-center text-[10px] font-black text-indigo-600 uppercase hover:underline">
                  Go to Tokenization Page
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
