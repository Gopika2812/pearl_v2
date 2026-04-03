import { useState, useEffect } from "react";
import { FaTimes, FaFileInvoiceDollar, FaDownload, FaCalendarAlt, FaSpinner, FaPencilAlt, FaCheck } from "react-icons/fa";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { API_BASE, fetchWithAuth } from "../../api";
import { toast } from "react-toastify";

const CustomerLedgerModal = ({ isOpen, onClose, customer, branch, onBalanceUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);

  // Editing state
  const [editingType, setEditingType] = useState(null); // 'opening' or 'closing'
  const [editValue, setEditValue] = useState("");
  const [savingBalance, setSavingBalance] = useState(false);

  // Date Filters
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date().toISOString().split('T')[0];
  
  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(lastDay);

  useEffect(() => {
    if (isOpen && customer?._id) {
      fetchLedger();
    }
  }, [isOpen, customer, startDate, endDate]);

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/customers/${customer._id}/ledger?startDate=${startDate}&endDate=${endDate}`);
      const result = await response.json();
      
      if (result.success) {
        setTransactions(result.data.transactions || []);
        setOpeningBalance(result.data.openingBalance || 0);
        setClosingBalance(result.data.closingBalance || 0);
      } else {
        toast.error(result.message || "Failed to fetch ledger");
      }
    } catch (err) {
      console.error("Error fetching ledger:", err);
      toast.error("Error connecting to server");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBalance = async () => {
    if (!editValue || isNaN(editValue)) {
      toast.error("Please enter a valid number");
      return;
    }

    setSavingBalance(true);
    try {
      const newValue = parseFloat(editValue);
      let diff = 0;

      if (editingType === 'opening') {
        diff = newValue - openingBalance;
      } else {
        diff = newValue - closingBalance;
      }

      // Permanent adjustment to customer's balance. 
      // We apply the delta specifically to the debit field for simplicity, 
      // or to whichever field makes sense. In this ERP, debit-credit = balance.
      // So adding diff to debit is equivalent to increasing the balance.
      
      const updatedDebit = (customer.debit || 0) + diff;

      const response = await fetchWithAuth(`${API_BASE}/customers/${customer._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ debit: updatedDebit })
      });

      if (response.ok) {
        toast.success(`Balance adjusted by ₹${Math.abs(diff).toLocaleString()}`);
        setEditingType(null);
        fetchLedger();
        if (onBalanceUpdate) onBalanceUpdate();
      } else {
        const error = await response.json();
        throw new Error(error.message || "Failed to update balance");
      }
    } catch (err) {
      console.error("Error saving balance:", err);
      toast.error(err.message || "Failed to save balance");
    } finally {
      setSavingBalance(false);
    }
  };

  if (!isOpen || !customer) return null;

  const handleExportPDF = async () => {
    const element = document.getElementById("customer-ledger-content");
    const canvas = await html2canvas(element, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
    pdf.save(`Ledger-${customer.name}-${startDate}-to-${endDate}.pdf`);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  };

  const balanceColor = (bal) => bal > 0 ? "text-red-600" : bal < 0 ? "text-green-600" : "text-gray-800";
  const balanceLabel = (bal) => bal > 0 ? "Dr" : bal < 0 ? "Cr" : "";

  const totalDebit = transactions.reduce((sum, t) => sum + t.debit, 0);
  const totalCredit = transactions.reduce((sum, t) => sum + t.credit, 0);

  return (
    <div className="fixed inset-0 z-[100] flex justify-center items-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 to-indigo-800 px-6 py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3 text-white">
            <div className="p-2 bg-white/20 rounded-lg">
              <FaFileInvoiceDollar size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold uppercase tracking-tight">Customer Ledger</h2>
              <p className="text-indigo-100 text-xs font-bold opacity-80 uppercase tracking-widest">{customer.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportPDF}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center gap-2 text-xs font-black border border-white/20 uppercase tracking-widest"
            >
              <FaDownload /> Export PDF
            </button>
            <button
              onClick={onClose}
              className="text-white hover:text-red-300 transition-colors p-2 rounded-full hover:bg-white/10"
              title="Close"
            >
              <FaTimes size={24} />
            </button>
          </div>
        </div>

        {/* Filters and Summary Toolbar */}
        <div className="bg-gray-100 border-b border-gray-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0">
           <div className="flex items-center gap-3">
             <div className="flex items-center bg-white border border-gray-300 rounded-lg overflow-hidden h-9 shadow-sm">
               <div className="bg-gray-50 px-3 flex items-center border-r border-gray-300">
                 <FaCalendarAlt className="text-gray-400 text-xs" />
               </div>
               <input 
                 type="date" 
                 className="px-2 text-xs font-bold focus:outline-none"
                 value={startDate}
                 onChange={(e) => setStartDate(e.target.value)}
               />
               <div className="px-2 text-gray-400 text-xs font-bold">TO</div>
               <input 
                 type="date" 
                 className="px-2 text-xs font-bold focus:outline-none border-l border-gray-300"
                 value={endDate}
                 onChange={(e) => setEndDate(e.target.value)}
               />
             </div>
             <button 
               onClick={fetchLedger}
               className="bg-blue-700 text-white px-4 h-9 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-blue-800 transition shadow-md shadow-blue-700/20"
             >
               Apply Filter
             </button>
           </div>

           <div className="flex gap-4">
              <div className="text-right group">
                <div className="flex items-center justify-end gap-1">
                  {editingType === 'opening' ? (
                    <div className="flex items-center gap-1 bg-white border rounded shadow-sm px-1">
                      <input 
                        type="number"
                        autoFocus
                        className="w-24 text-xs font-bold outline-none"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveBalance()}
                      />
                      <button onClick={handleSaveBalance} className="text-green-600 p-1 hover:bg-green-50 rounded">
                        {savingBalance ? <FaSpinner className="animate-spin" /> : <FaCheck size={10} />}
                      </button>
                      <button onClick={() => setEditingType(null)} className="text-red-600 p-1 hover:bg-red-50 rounded">
                        <FaTimes size={10} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Opening Balance</p>
                      <button 
                        onClick={() => { setEditingType('opening'); setEditValue(openingBalance.toString()); }}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 transition"
                      >
                        <FaPencilAlt size={8} />
                      </button>
                    </>
                  )}
                </div>
                {editingType !== 'opening' && (
                  <p className={`text-sm font-black ${balanceColor(openingBalance)}`}>₹{Math.abs(openingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {balanceLabel(openingBalance)}</p>
                )}
              </div>
              <div className="w-px h-8 bg-gray-300 mx-1"></div>
              <div className="text-right group">
                 <div className="flex items-center justify-end gap-1">
                  {editingType === 'closing' ? (
                    <div className="flex items-center gap-1 bg-white border rounded shadow-sm px-1">
                      <input 
                        type="number"
                        autoFocus
                        className="w-24 text-xs font-bold outline-none"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveBalance()}
                      />
                      <button onClick={handleSaveBalance} className="text-green-600 p-1 hover:bg-green-50 rounded">
                        {savingBalance ? <FaSpinner className="animate-spin" /> : <FaCheck size={10} />}
                      </button>
                      <button onClick={() => setEditingType(null)} className="text-red-600 p-1 hover:bg-red-50 rounded">
                        <FaTimes size={10} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Closing Balance</p>
                      <button 
                        onClick={() => { setEditingType('closing'); setEditValue(closingBalance.toString()); }}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 transition"
                      >
                        <FaPencilAlt size={8} />
                      </button>
                    </>
                  )}
                </div>
                {editingType !== 'closing' && (
                  <p className={`text-sm font-black ${balanceColor(closingBalance)}`}>₹{Math.abs(closingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {balanceLabel(closingBalance)}</p>
                )}
              </div>
           </div>
        </div>

        {/* Content */}
        <div id="customer-ledger-content" className="flex-1 overflow-y-auto p-8 bg-white">
          {/* PDF HEADER: SELLER INFO */}
          <div className="hidden pdf-only flex justify-between items-start border-b-4 border-blue-900 pb-6 mb-8">
            <div className="flex items-center gap-6">
              {branch?.logo ? (
                 <img src={branch.logo} alt="Logo" className="w-24 h-24 object-contain rounded-xl" />
              ) : (
                 <div className="w-20 h-20 bg-blue-900 text-white rounded-xl flex items-center justify-center text-4xl font-black">
                   {branch?.name?.charAt(0) || "P"}
                 </div>
              )}
              <div>
                <h1 className="text-3xl font-black text-blue-900 uppercase tracking-tight">{branch?.name || "Pearls ERP Branch"}</h1>
                <p className="text-sm text-gray-600 font-bold max-w-md mt-1 italic">
                  {branch?.address}, {branch?.city}, {branch?.state} - {branch?.pincode}
                </p>
                <div className="flex gap-4 mt-2 text-xs font-black text-gray-500 uppercase tracking-wider">
                   {branch?.phone && <span>📞 {branch.phone}</span>}
                   {branch?.gstin && <span>📄 GSTIN: {branch.gstin}</span>}
                </div>
              </div>
            </div>
            <div className="text-right">
               <h2 className="text-xl font-black text-white bg-blue-900 px-4 py-1 rounded uppercase tracking-widest">Ledger Report</h2>
               <p className="text-xs font-bold text-gray-400 mt-2 uppercase tracking-widest">Selective Period</p>
               <p className="text-sm font-black text-blue-900">{formatDate(startDate)} TO {formatDate(endDate)}</p>
            </div>
          </div>

          {/* CUSTOMER DETAILS (In PDF) */}
          <div className="hidden pdf-only grid grid-cols-2 gap-8 mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-200">
             <div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Customer Details</h3>
                <p className="text-xl font-black text-slate-900 uppercase">{customer.name}</p>
                <p className="text-sm font-bold text-slate-500 mt-1">{customer.address || "No Address Provided"}</p>
                <div className="mt-4 space-y-1">
                   <p className="text-xs font-bold text-slate-700">📞 WhatsApp: <span className="text-slate-900">{customer.whatsapp || "N/A"}</span></p>
                   <p className="text-xs font-bold text-slate-700">📄 GSTIN: <span className="text-slate-900 font-black">{customer.gstin || "Unregistered"}</span></p>
                </div>
             </div>
             <div className="flex flex-col justify-center items-end border-l border-slate-200 pl-8">
                <div className="text-right mb-4">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Opening Balance</p>
                   <p className={`text-xl font-black ${balanceColor(openingBalance)} italic`}>₹{Math.abs(openingBalance).toLocaleString()} {balanceLabel(openingBalance)}</p>
                </div>
                <div className="text-right">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Dues</p>
                   <p className={`text-2xl font-black ${balanceColor(closingBalance)}`}>₹{Math.abs(closingBalance).toLocaleString()} {balanceLabel(closingBalance)}</p>
                </div>
             </div>
          </div>

          <div className="pdf-only hidden mb-4">
             <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest border-l-4 border-blue-900 pl-2">Transaction History</h4>
          </div>

          {/* Transactions Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-blue-50 border-b border-blue-100 text-blue-900 font-black uppercase text-[10px] tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Particulars</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4 text-right">Debit (Owed)</th>
                    <th className="px-6 py-4 text-right">Credit (Paid)</th>
                    <th className="px-6 py-4 text-right bg-blue-100/50">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {/* Opening Balance Row */}
                  <tr className="bg-amber-50/30 border-b border-amber-100 italic">
                    <td className="px-6 py-3 text-gray-400">{formatDate(startDate)}</td>
                    <td className="px-6 py-3 font-black text-[#5e7182] uppercase tracking-wide">Opening Balance B/F</td>
                    <td className="px-6 py-3 text-gray-400 text-xs">O/B</td>
                    <td className="px-6 py-3 text-right">-</td>
                    <td className="px-6 py-3 text-right">-</td>
                    <td className="px-6 py-3 text-right font-black bg-blue-50/30 text-blue-900">
                      ₹{Math.abs(openingBalance).toLocaleString()} {balanceLabel(openingBalance)}
                    </td>
                  </tr>

                  {loading ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-20 text-center">
                        <FaSpinner className="animate-spin text-blue-600 text-3xl mx-auto mb-2" />
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Recalculating Ledger...</p>
                      </td>
                    </tr>
                  ) : transactions.length > 0 ? (
                    transactions.map((txn, index) => (
                      <tr 
                        key={txn.id} 
                        className={`hover:bg-gray-50 transition-colors group ${txn.type === 'RECEIPT' ? 'bg-green-50/20' : txn.type === 'CREDIT_NOTE' ? 'bg-indigo-50/20' : ''}`}
                      >
                        <td className="px-6 py-4 text-gray-600 text-xs font-bold">
                          {formatDate(txn.date)}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-gray-800 text-xs uppercase tracking-tight">{txn.particulars}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${
                            txn.type === "INVOICE" ? "bg-red-100 text-red-700" : 
                            txn.type === "RECEIPT" ? "bg-green-100 text-green-700" : 
                            "bg-indigo-100 text-indigo-700"
                          }`}>
                            {txn.type.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-red-600">
                          {txn.debit > 0 ? `₹${txn.debit.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "-"}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-green-600">
                          {txn.credit > 0 ? `₹${txn.credit.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "-"}
                        </td>
                        <td className="px-6 py-4 text-right font-black bg-blue-50/30 text-blue-900 group-hover:scale-105 transition-transform duration-200">
                          ₹{Math.abs(txn.balance).toLocaleString()} {balanceLabel(txn.balance)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-gray-500 italic bg-gray-50/50">
                        No transactions found for this period
                      </td>
                    </tr>
                  )}

                  {/* Closing Balance Row */}
                  <tr className="bg-blue-900 text-white shadow-xl isolate z-10">
                    <td className="px-6 py-5">{formatDate(endDate)}</td>
                    <td className="px-6 py-5 font-black uppercase tracking-widest text-base">Closing Balance C/F</td>
                    <td className="px-6 py-5 uppercase font-bold text-xs opacity-70">C/B</td>
                    <td className="px-6 py-5 text-right font-bold">
                       ₹{totalDebit.toLocaleString()}
                    </td>
                    <td className="px-6 py-5 text-right font-bold">
                       ₹{totalCredit.toLocaleString()}
                    </td>
                    <td className="px-6 py-5 text-right font-black text-lg bg-white/10">
                      ₹{Math.abs(closingBalance).toLocaleString()} {balanceLabel(closingBalance)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* PDF FOOTER SUMMARY */}
          <div className="hidden pdf-only mt-12 grid grid-cols-4 gap-4 px-6 py-8 bg-blue-900 text-white rounded-2xl shadow-xl">
             <div className="border-r border-white/20 pr-4">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Opening Balance</p>
                <p className="text-lg font-black mt-1">₹{Math.abs(openingBalance).toLocaleString()} {balanceLabel(openingBalance)}</p>
             </div>
             <div className="border-r border-white/20 px-4">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Total Debit (+)</p>
                <p className="text-lg font-black mt-1 text-red-200">₹{totalDebit.toLocaleString()}</p>
             </div>
             <div className="border-r border-white/20 px-4">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Total Credit (-)</p>
                <p className="text-lg font-black mt-1 text-green-200">₹{totalCredit.toLocaleString()}</p>
             </div>
             <div className="pl-4">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Statement Balance</p>
                <p className="text-2xl font-black mt-1">₹{Math.abs(closingBalance).toLocaleString()} {balanceLabel(closingBalance)}</p>
             </div>
          </div>

          <div className="hidden pdf-only flex justify-between items-center mt-12 pt-8 border-t border-gray-200">
             <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Generated via Pearls ERP on {new Date().toLocaleString()}
             </div>
             <div className="text-right">
                <div className="w-32 h-1 bg-gray-200 mb-2"></div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Authorized Signature</p>
             </div>
          </div>
          
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
             <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-400"></div>
                <span>DR (Debit) means amount owed to us</span>
             </div>
             <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                <span>CR (Credit) means payment received or return</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerLedgerModal;
