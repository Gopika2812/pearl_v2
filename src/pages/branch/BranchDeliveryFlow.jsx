import React, { useEffect, useState } from "react";
import { FaHistory, FaSearch, FaSync, FaTruck, FaCheckCircle, FaUser, FaCommentDots, FaMapMarkerAlt } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";
import FilterableSelect from "../../components/FilterableSelect";
import { getInvoiceHTML } from "../../utils/invoiceUtils";

const BranchDeliveryFlow = () => {
  const { currentBranch, user } = useBranch();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL"); // ALL, PENDING, PICKED, COMPLETED
  const [filterFromDate, setFilterFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [filterToDate, setFilterToDate] = useState(new Date().toISOString().split("T")[0]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [updatingId, setUpdatingId] = useState(null);
  const [branchUsers, setBranchUsers] = useState([]);

  const fetchBranchUsers = async () => {
    if (!currentBranch?._id) return;
    try {
      const res = await fetchWithAuth(`${API_BASE}/branch-users/branch/${currentBranch._id}`);
      const data = await res.json();
      if (data.success) {
        setBranchUsers(data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch branch users", err);
    }
  };

  const fetchInvoices = async () => {
    if (!currentBranch?._id) return;
    setLoading(true);
    try {
      let url = `${API_BASE}/invoices?branchId=${currentBranch._id}&page=${currentPage}&limit=50`;
      if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
      if (filterFromDate) url += `&fromDate=${filterFromDate}`;
      if (filterToDate) url += `&toDate=${filterToDate}`;
      
      const res = await fetchWithAuth(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch invoices");
      
      let filteredData = data.data || [];
      
      // Client-side status filtering if backend doesn't support it yet
      if (filterStatus !== "ALL") {
        filteredData = filteredData.filter(inv => (inv.deliveryStatus || "PENDING") === filterStatus);
      }

      setInvoices(filteredData);
      if (data.pagination) setPagination(data.pagination);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
    fetchBranchUsers();
  }, [currentBranch?._id, filterFromDate, filterToDate, currentPage, filterStatus]);

  // Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchInvoices();
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const handleUpdateField = async (invoiceId, field, value) => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/invoices/${invoiceId}/delivery-flow`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: value, updatedBy: user?.username || "System" })
      });
      const data = await res.json();
      if (data.success) {
        setInvoices(prev => prev.map(inv => inv._id === invoiceId ? data.data : inv));
      } else {
        toast.error(data.message || "Update failed");
      }
    } catch (err) {
      toast.error("Failed to update field");
    }
  };

  const handleMarkStatus = async (invoiceId, status) => {
    const confirmMsg = status === "COMPLETED" 
      ? "Mark this delivery as COMPLETED?" 
      : "Mark this delivery as PICKED?";
    
    if (!window.confirm(confirmMsg)) return;
    setUpdatingId(invoiceId);
    try {
      const res = await fetchWithAuth(`${API_BASE}/invoices/${invoiceId}/delivery-flow`, {
        method: "PATCH",
        body: JSON.stringify({ 
          deliveryStatus: status, 
          updatedBy: user?.username || "System",
          deliveryCompletedAt: status === "COMPLETED" ? new Date() : null
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Delivery marked as ${status.toLowerCase()}`);
        setInvoices(prev => prev.map(inv => inv._id === invoiceId ? data.data : inv));
      } else {
        toast.error(data.message || "Update failed");
      }
    } catch (err) {
      toast.error("Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleViewInvoice = async (invoice) => {
    try {
        // Fetch full details if items are missing
        let fullInv = invoice;
        if (!invoice.items || invoice.items.length === 0) {
            const res = await fetchWithAuth(`${API_BASE}/invoices/${invoice._id}`);
            const data = await res.json();
            fullInv = data.success ? data.data : data;
        }

        const printWindow = window.open("", "_blank");
        if (!printWindow) {
            toast.warning("Pop-up blocked! Please allow pop-ups to view invoice.");
            return;
        }

        const html = getInvoiceHTML(fullInv, 1, fullInv, fullInv, 'INVOICE');
        printWindow.document.write(html);
        printWindow.document.close();
    } catch (err) {
        console.error("View invoice failed:", err);
        toast.error("Failed to load invoice details");
    }
  };

  const formatIST = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20">
      <div className="w-full mx-auto px-4 sm:px-8 py-4">
        {/* HEADER */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
                <FaTruck className="text-white text-xl" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
                  Delivery <span className="text-indigo-600">Flow</span>
                </h1>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  Track and manage Sales Invoice processing stages
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchInvoices}
                className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-50 transition shadow-sm"
              >
                <FaSync className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>
        </div>

        {/* FILTERS */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-1">
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Search</label>
              <div className="relative group">
                <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <input
                  type="text"
                  placeholder="SI ID, Customer, Names..."
                  className="w-full bg-slate-50/50 border border-slate-100 rounded-xl pl-11 pr-4 py-2.5 text-sm font-bold focus:bg-white focus:border-indigo-500 transition-all outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Status</label>
              <select
                className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm font-bold focus:bg-white focus:border-indigo-500 transition-all outline-none"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="ALL">ALL STATUS</option>
                <option value="PENDING">PENDING</option>
                <option value="PICKED">PICKED</option>
                <option value="COMPLETED">COMPLETED</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">From</label>
              <input
                type="date"
                className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm font-black focus:bg-white focus:border-indigo-500 transition-all outline-none"
                value={filterFromDate}
                onChange={(e) => setFilterFromDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">To</label>
              <input
                type="date"
                className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm font-black focus:bg-white focus:border-indigo-500 transition-all outline-none"
                value={filterToDate}
                onChange={(e) => setFilterToDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* TABLE */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">S.No</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">SI ID / Date</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer / Area</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Billed Person</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Storage Man</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Stock Checker</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Delivery Person</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status / Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                      <FaSync className="animate-spin inline-block mr-2" /> Loading Deliveries...
                    </td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                      No matching records found.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv, idx) => (
                    <tr key={inv._id} className={`hover:bg-slate-50/50 transition-colors ${inv.deliveryStatus === 'COMPLETED' ? 'bg-emerald-50/20' : ''}`}>
                      <td className="px-6 py-4">
                        <span className="text-xs font-black text-slate-400">{(currentPage - 1) * 50 + idx + 1}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <button 
                            onClick={() => handleViewInvoice(inv)}
                            className="text-left text-xs font-black text-indigo-600 hover:text-indigo-800 transition-colors"
                          >
                            {inv.invoiceNumber}
                          </button>
                          <span className="text-[9px] font-bold text-slate-400">{formatIST(inv.invoiceDate)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-700">{inv.customer?.name}</span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <FaMapMarkerAlt className="text-[10px] text-indigo-400" />
                            <input 
                              type="text"
                              value={inv.area || inv.customer?.address || ""}
                              onChange={(e) => handleUpdateField(inv._id, 'area', e.target.value)}
                              placeholder="Enter Area"
                              className="text-[10px] font-bold text-indigo-600 bg-transparent border-b border-transparent hover:border-indigo-200 focus:border-indigo-500 outline-none w-full"
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md">{inv.billingPerson || inv.generatedBy || "-"}</span>
                      </td>
                      
                      {/* STORAGE MAN */}
                      <td className="px-6 py-4 min-w-[150px]">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <FaUser className="text-[10px] text-slate-300" />
                            <FilterableSelect
                              options={branchUsers.map(u => ({ _id: u.name, name: u.name }))}
                              value={inv.storageMan}
                              onChange={(val) => handleUpdateField(inv._id, 'storageMan', val)}
                              placeholder="Select User"
                              className="border-none bg-transparent !p-0 !text-xs !font-bold text-slate-700"
                            />
                          </div>
                          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                            <FaCommentDots className="text-[10px] text-slate-300" />
                            <input 
                              type="text"
                              value={inv.storageManComment || ""}
                              onChange={(e) => handleUpdateField(inv._id, 'storageManComment', e.target.value)}
                              placeholder="Comment"
                              className="text-[9px] font-medium text-slate-500 bg-transparent outline-none w-full"
                            />
                          </div>
                        </div>
                      </td>

                      {/* STOCK CHECKER */}
                      <td className="px-6 py-4 min-w-[150px]">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <FaUser className="text-[10px] text-slate-300" />
                            <FilterableSelect
                              options={branchUsers.map(u => ({ _id: u.name, name: u.name }))}
                              value={inv.stockChecker}
                              onChange={(val) => handleUpdateField(inv._id, 'stockChecker', val)}
                              placeholder="Select User"
                              className="border-none bg-transparent !p-0 !text-xs !font-bold text-slate-700"
                            />
                          </div>
                          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                            <FaCommentDots className="text-[10px] text-slate-300" />
                            <input 
                              type="text"
                              value={inv.stockCheckerComment || ""}
                              onChange={(e) => handleUpdateField(inv._id, 'stockCheckerComment', e.target.value)}
                              placeholder="Comment"
                              className="text-[9px] font-medium text-slate-500 bg-transparent outline-none w-full"
                            />
                          </div>
                        </div>
                      </td>

                      {/* DELIVERY PERSON */}
                      <td className="px-6 py-4 min-w-[150px]">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <FaUser className="text-[10px] text-slate-300" />
                            <FilterableSelect
                              options={branchUsers.map(u => ({ _id: u.name, name: u.name }))}
                              value={inv.deliveryPerson}
                              onChange={(val) => handleUpdateField(inv._id, 'deliveryPerson', val)}
                              placeholder="Select User"
                              className="border-none bg-transparent !p-0 !text-xs !font-bold text-slate-700"
                            />
                          </div>
                          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                            <FaCommentDots className="text-[10px] text-slate-300" />
                            <input 
                              type="text"
                              value={inv.deliveryPersonComment || ""}
                              onChange={(e) => handleUpdateField(inv._id, 'deliveryPersonComment', e.target.value)}
                              placeholder="Comment"
                              className="text-[9px] font-medium text-slate-500 bg-transparent outline-none w-full"
                            />
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-center min-w-[140px]">
                        {inv.deliveryStatus === "COMPLETED" ? (
                          <div className="flex flex-col items-center gap-2">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                              <FaCheckCircle />
                              Completed
                            </div>
                            <span className="text-[8px] font-bold text-slate-400">{formatIST(inv.deliveryCompletedAt)}</span>
                            <button
                              onClick={() => handleMarkStatus(inv._id, "PENDING")}
                              className="text-[9px] font-bold text-indigo-500 hover:text-indigo-700 uppercase tracking-widest underline underline-offset-4"
                            >
                              Revert to Pending
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {inv.deliveryStatus === "PICKED" && (
                              <div className="flex flex-col items-center gap-1 mb-1">
                                <div className="flex items-center justify-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[9px] font-black uppercase tracking-widest">
                                  <FaCheckCircle size={10} />
                                  Picked
                                </div>
                                <button
                                  onClick={() => handleMarkStatus(inv._id, "PENDING")}
                                  className="text-[8px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest underline"
                                >
                                  Revert
                                </button>
                              </div>
                            )}
                            {(inv.deliveryStatus === "PENDING" || !inv.deliveryStatus) && (
                              <button
                                onClick={() => handleMarkStatus(inv._id, "PICKED")}
                                disabled={updatingId === inv._id}
                                className="inline-flex items-center justify-center gap-2 px-3 py-1.5 bg-amber-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-amber-600 transition shadow-lg shadow-amber-100 disabled:opacity-50"
                              >
                                {updatingId === inv._id ? <FaSync className="animate-spin" /> : <FaTruck />}
                                Mark Picked
                              </button>
                            )}
                            <button
                              onClick={() => handleMarkStatus(inv._id, "COMPLETED")}
                              disabled={updatingId === inv._id}
                              className="inline-flex items-center justify-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 disabled:opacity-50"
                            >
                              {updatingId === inv._id ? <FaSync className="animate-spin" /> : <FaCheckCircle />}
                              Mark Complete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* PAGINATION */}
          <div className="bg-slate-50/50 p-4 border-t border-slate-100 flex items-center justify-between">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
               Total: {pagination.total} Records | Page {currentPage} of {pagination.pages}
             </p>
             <div className="flex items-center gap-2">
                <button 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 disabled:opacity-50"
                >
                  Prev
                </button>
                <button 
                  disabled={currentPage >= pagination.pages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 disabled:opacity-50"
                >
                  Next
                </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BranchDeliveryFlow;
