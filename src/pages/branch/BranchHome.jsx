import { useState, useEffect } from "react";
import { FaHome, FaPhone, FaCalendarCheck, FaClock, FaTicketAlt, FaCheckCircle, FaInbox, FaChartLine, FaFileInvoiceDollar, FaMoneyBillWave, FaUsers, FaBan, FaFileSignature } from "react-icons/fa";
import { Link } from "react-router-dom";
import { useBranch } from "../../context/BranchContext";
import { API_BASE, fetchWithAuth } from "../../api";

// Helper for date ranges
const getDateRange = (rangeType) => {
  const today = new Date();
  today.setHours(0,0,0,0);
  const start = new Date(today);
  const end = new Date(today);
  end.setHours(23,59,59,999);

  switch(rangeType) {
    case 'today':
      return { startDate: start, endDate: end };
    case 'yesterday':
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
      return { startDate: start, endDate: end };
    case 'thisWeek':
      start.setDate(start.getDate() - start.getDay()); // Sunday as start
      return { startDate: start, endDate: end };
    case 'thisMonth':
      start.setDate(1);
      return { startDate: start, endDate: end };
    case 'thisYear':
      start.setMonth(0, 1);
      return { startDate: start, endDate: end };
    default:
      return { startDate: start, endDate: end };
  }
}

export default function BranchHome() {
  const { branch, user, currentBranch } = useBranch();
  const [tokens, setTokens] = useState([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  
  // Dashboard state
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [filterType, setFilterType] = useState("thisMonth");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  useEffect(() => {
    if (currentBranch?._id) {
      fetchMyTokens();
      fetchDashboardStats();
    }
  }, [currentBranch?._id, filterType]);

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

  const fetchDashboardStats = async (startOverride, endOverride) => {
    setLoadingStats(true);
    try {
      let startDate, endDate;
      
      if (startOverride && endOverride) {
        startDate = new Date(startOverride);
        endDate = new Date(endOverride);
      } else if (filterType !== 'custom') {
        const range = getDateRange(filterType);
        startDate = range.startDate;
        endDate = range.endDate;
      } else {
        if (!customStart || !customEnd) return;
        startDate = new Date(customStart);
        endDate = new Date(customEnd);
      }

      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      const res = await fetchWithAuth(`${API_BASE}/branches/${currentBranch._id}/dashboard-stats?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (err) {
      console.error("Error fetching stats:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleCustomFilter = () => {
    if (!customStart || !customEnd) return;
    setFilterType("custom");
    fetchDashboardStats(customStart, customEnd);
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20 px-4 md:px-6 pb-10">
      <div className="max-w-[1400px] mx-auto">
        
        {/* TOP BRANDING BANNER */}
        <div className="bg-[#00376B] text-white rounded-2xl shadow-xl p-8 mb-6 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#319CD3] rounded-full mix-blend-screen filter blur-3xl opacity-40 translate-x-1/2 -translate-y-1/2"></div>
          <div className="relative z-10">
            <h1 className="text-3xl font-black mb-1">
              Welcome back to {branch?.name} 👋
            </h1>
            <p className="text-[#319CD3] font-semibold tracking-wide">
              Logged in as: <span className="text-white">{user?.username}</span> | Location: <span className="text-white">{branch?.location}</span>
            </p>
          </div>
          <div className="relative z-10 w-full md:w-auto">
             <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-6 py-3 rounded-xl border border-white/20 shadow-lg">
               <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]"></div>
               <span className="text-sm font-bold text-white tracking-widest uppercase">System Online</span>
             </div>
          </div>
        </div>

        {/* DASHBOARD FILTERS */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6 flex flex-col xl:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap bg-gray-100 p-1.5 rounded-xl w-full xl:w-auto gap-1">
            {['today', 'yesterday', 'thisWeek', 'thisMonth', 'thisYear'].map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`flex-1 xl:flex-none px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                  filterType === type 
                  ? "bg-[#319CD3] text-white shadow-md" 
                  : "text-gray-500 hover:text-[#00376B] hover:bg-white"
                }`}
              >
                {type.replace(/([A-Z])/g, ' $1')}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            <input 
              type="date" 
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              className="flex-1 xl:flex-none px-4 py-2.5 bg-gray-50 border border-gray-200 text-sm font-bold text-gray-700 rounded-xl focus:outline-none focus:border-[#319CD3]" 
            />
            <span className="text-gray-400 font-black text-xs">TO</span>
            <input 
              type="date" 
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              className="flex-1 xl:flex-none px-4 py-2.5 bg-gray-50 border border-gray-200 text-sm font-bold text-gray-700 rounded-xl focus:outline-none focus:border-[#319CD3]" 
            />
            <button 
              onClick={handleCustomFilter}
              className="w-full xl:w-auto px-6 py-2.5 bg-[#00376B] text-white rounded-xl text-xs font-black tracking-widest hover:bg-[#002855] transition-colors shadow-sm"
            >
              APPLY FILTER
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* LEFT: MAIN KPI STATS */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Sales & Purchases Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
               {/* Total Sales */}
               <div className="bg-white p-5 rounded-2xl shadow-sm border-b-[6px] border-[#319CD3] hover:shadow-md transition">
                 <div className="flex justify-between items-start mb-3">
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Sales Order</p>
                   <FaChartLine className="text-[#319CD3] text-xl opacity-60" />
                 </div>
                 <h3 className="text-2xl font-black text-[#00376B]">{loadingStats ? "..." : formatCurrency(stats?.totalSalesValue)}</h3>
               </div>
               
               {/* Sales Invoices */}
               <div className="bg-white p-5 rounded-2xl shadow-sm border-b-[6px] border-emerald-500 hover:shadow-md transition">
                 <div className="flex justify-between items-start mb-3">
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sales Invoiced</p>
                   <FaFileInvoiceDollar className="text-emerald-500 text-xl opacity-60" />
                 </div>
                 <h3 className="text-2xl font-black text-gray-800">{loadingStats ? "..." : formatCurrency(stats?.totalSalesInvoiceValue)}</h3>
               </div>

               {/* Total Purchases */}
               <div className="bg-white p-5 rounded-2xl shadow-sm border-b-[6px] border-purple-500 hover:shadow-md transition">
                 <div className="flex justify-between items-start mb-3">
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Purchase Order</p>
                   <FaChartLine className="text-purple-500 text-xl opacity-60" />
                 </div>
                 <h3 className="text-2xl font-black text-gray-800">{loadingStats ? "..." : formatCurrency(stats?.totalPurchaseOrderValue)}</h3>
               </div>

               {/* Purchase Invoices */}
               <div className="bg-white p-5 rounded-2xl shadow-sm border-b-[6px] border-orange-500 hover:shadow-md transition">
                 <div className="flex justify-between items-start mb-3">
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Purchase Invoiced</p>
                   <FaFileInvoiceDollar className="text-orange-500 text-xl opacity-60" />
                 </div>
                 <h3 className="text-2xl font-black text-gray-800">{loadingStats ? "..." : formatCurrency(stats?.purchaseInvoiceValues)}</h3>
               </div>
            </div>

            {/* Financials & Status Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Accounts Panel */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                   <FaMoneyBillWave className="text-[#319CD3] text-lg" />
                   <h3 className="text-xs font-black text-[#00376B] uppercase tracking-widest">Accounts Flow</h3>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-center px-4 py-3 bg-emerald-50 rounded-xl border border-emerald-100">
                    <span className="text-xs font-black text-emerald-800 uppercase tracking-wider">Receipts (IN)</span>
                    <span className="text-xl font-black text-emerald-700">{loadingStats ? "..." : formatCurrency(stats?.receiptValue)}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-3 bg-rose-50 rounded-xl border border-rose-100">
                    <span className="text-xs font-black text-rose-800 uppercase tracking-wider">Payments (OUT)</span>
                    <span className="text-xl font-black text-rose-700">{loadingStats ? "..." : formatCurrency(stats?.paymentValue)}</span>
                  </div>
                </div>
              </div>

              {/* Outstanding Orders Panel */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                   <FaFileSignature className="text-[#319CD3] text-lg" />
                   <h3 className="text-xs font-black text-[#00376B] uppercase tracking-widest">Pending Conversion</h3>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-center px-4 py-3 bg-amber-50 rounded-xl border border-amber-100">
                    <span className="text-xs font-black text-amber-800 uppercase tracking-wider">Uninvoiced Sales</span>
                    <span className="text-2xl font-black text-amber-600">{loadingStats ? "..." : stats?.notGeneratedSalesInvoiceCount} <span className="text-xs text-amber-800/50">Orders</span></span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-3 bg-indigo-50 rounded-xl border border-indigo-100">
                    <span className="text-xs font-black text-indigo-800 uppercase tracking-wider">Uninvoiced Purchases</span>
                    <span className="text-2xl font-black text-indigo-600">{loadingStats ? "..." : stats?.notGeneratedPurchaseInvoiceCount} <span className="text-xs text-indigo-800/50">Orders</span></span>
                  </div>
                </div>
              </div>

            </div>

            {/* Global Standing & Exceptions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <div className="bg-[#00376B] p-6 rounded-2xl shadow-sm text-white border border-[#002855]">
                 <div className="flex justify-between items-start mb-4">
                   <p className="text-[10px] font-black text-[#319CD3] uppercase tracking-widest">Total Customer Debits</p>
                   <div className="p-2 bg-white/10 rounded-lg"><FaUsers className="text-[#319CD3]" /></div>
                 </div>
                 <h3 className="text-2xl font-black truncate">{loadingStats ? "..." : formatCurrency(stats?.totalCustomerDebit)}</h3>
               </div>
               
               <div className="bg-[#319CD3] p-6 rounded-2xl shadow-sm text-white border border-[#2380af]">
                 <div className="flex justify-between items-start mb-4">
                   <p className="text-[10px] font-black text-[#00376B] uppercase tracking-widest">Total Customer Credits</p>
                   <div className="p-2 bg-black/10 rounded-lg"><FaUsers className="text-[#00376B]" /></div>
                 </div>
                 <h3 className="text-2xl font-black truncate">{loadingStats ? "..." : formatCurrency(stats?.totalCustomerCredit)}</h3>
               </div>

               <div className="bg-red-50 border border-red-100 p-6 rounded-2xl shadow-sm">
                 <div className="flex justify-between items-start mb-4">
                   <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Canceled Orders Val</p>
                   <div className="p-2 bg-red-100 rounded-lg"><FaBan className="text-red-500" /></div>
                 </div>
                 <h3 className="text-2xl font-black text-red-600 truncate">{loadingStats ? "..." : formatCurrency(stats?.cancelOrdersValue)}</h3>
               </div>
            </div>

          </div>

          {/* RIGHT: TOKENS & QUICK INFO */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Quick Branch Info */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-5">Branch Identity</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Code</p>
                  <p className="text-sm font-black text-[#00376B]">{branch?.code || "-"}</p>
                </div>
                <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Phone</p>
                  <p className="text-sm font-black text-[#00376B]">{branch?.phone || "-"}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">GSTIN</p>
                  <p className="text-sm font-black text-[#00376B]">{branch?.gstin || "-"}</p>
                </div>
              </div>
            </div>

            {/* Tokens */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[520px]">
              <div className="bg-[#00376B] p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FaTicketAlt className="text-[#319CD3] text-lg" />
                  <h3 className="text-white font-black text-[10px] uppercase tracking-[0.2em]">Active Tasks</h3>
                </div>
                <div className="bg-[#319CD3] px-2.5 py-1 rounded-md text-white text-[10px] font-black">{tokens.length}</div>
              </div>
              
              <div className="p-4 flex-1 overflow-y-auto space-y-3 no-scrollbar bg-slate-50">
                {loadingTokens ? (
                   <div className="py-12 text-center animate-pulse text-[#319CD3] font-black uppercase text-[10px] tracking-[0.2em]">Synchronizing...</div>
                ) : tokens.length === 0 ? (
                  <div className="py-16 text-center text-slate-400">
                    <FaInbox className="text-gray-300 text-4xl mx-auto mb-4 opacity-70" />
                    <p className="text-gray-400 font-bold uppercase text-[10px] tracking-[0.2em]">Inbox Zero</p>
                  </div>
                ) : (
                  tokens.map(t => (
                    <Link 
                      to="/branch/tokenization" 
                      key={t._id}
                      className="block p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-[#319CD3] hover:shadow-md transition-all group"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[9px] font-black text-[#319CD3] tracking-wider uppercase group-hover:text-[#00376B] transition-colors">{t.tokenId}</span>
                        <span className="text-[9px] font-bold text-gray-400">{new Date(t.createdAt).toLocaleDateString()}</span>
                      </div>
                      <h4 className="text-xs font-black text-gray-800 truncate mb-1 group-hover:text-[#00376B] transition-colors">{t.customer?.name || "Internal Dispatch"}</h4>
                      <p className="text-[10px] font-medium text-gray-500 line-clamp-2 leading-relaxed">{t.message}</p>
                    </Link>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
