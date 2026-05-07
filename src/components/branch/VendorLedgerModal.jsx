import { useState, useEffect } from "react";
import { FaTimes, FaFileInvoiceDollar, FaDownload, FaCalendarAlt, FaSpinner, FaPencilAlt, FaCheck } from "react-icons/fa";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import * as XLSX from 'xlsx';
import { API_BASE, fetchWithAuth } from "../../api";
import { toast } from "react-toastify";
import { useBranch } from "../../context/BranchContext";

const VendorLedgerModal = ({ isOpen, onClose, supplier: propSupplier }) => {
  const { user } = useBranch();
  const [loading, setLoading] = useState(false);
  const [supplier, setSupplier] = useState(propSupplier);
  const [transactions, setTransactions] = useState([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);

  // Editing state for balance adjustments
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
    if (isOpen && propSupplier?._id) {
      setSupplier(propSupplier);
      fetchLedger();
    }
  }, [isOpen, propSupplier, startDate, endDate]);

  const fetchLedger = async () => {
    if (!propSupplier?._id) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/vendors/${propSupplier._id}/ledger?startDate=${startDate}&endDate=${endDate}`);
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

      const updatedCredit = (supplier.credit || 0) + diff;

      const response = await fetchWithAuth(`${API_BASE}/vendors/${supplier._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credit: updatedCredit })
      });

      if (response.ok) {
        toast.success(`Balance adjusted by ₹${Math.abs(diff).toLocaleString()}`);
        setEditingType(null);
        fetchLedger();
        // Update local supplier state if needed
        const updatedData = await response.json();
        if (updatedData.success) setSupplier(updatedData.data);
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

  if (!isOpen || !supplier) return null;

  const handleExportPDF = async () => {
    const element = document.getElementById("vendor-ledger-content");
    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
    pdf.save(`Ledger-${supplier.name}-${startDate}-to-${endDate}.pdf`);
  };
  
  const handleExportExcel = () => {
    try {
      const data = [];
      
      // Header info
      data.push([supplier.name]);
      data.push([`Period: ${formatDate(startDate)} to ${formatDate(endDate)}`]);
      data.push([]); // Spacer

      // Table Header
      data.push(["Date", "Particulars", "Type", "Debit (Paid/Return)", "Credit (Billed)", "Balance"]);

      // Opening Balance
      data.push([
        formatDate(startDate),
        "OPENING BALANCE B/F",
        "O/B",
        0,
        0,
        `${Math.abs(openingBalance).toLocaleString()} ${balanceLabel(openingBalance)}`
      ]);

      // Transactions
      transactions.forEach(txn => {
        data.push([
          formatDate(txn.date),
          txn.particulars,
          txn.type.replace("_", " "),
          txn.debit || 0,
          txn.credit || 0,
          `${Math.abs(txn.balance).toLocaleString()} ${balanceLabel(txn.balance)}`
        ]);
      });

      // Closing Totals
      data.push([]);
      data.push([
        formatDate(endDate),
        "CLOSING BALANCE C/F",
        "C/B",
        transactions.reduce((sum, t) => sum + t.debit, 0),
        transactions.reduce((sum, t) => sum + t.credit, 0),
        `${Math.abs(closingBalance).toLocaleString()} ${balanceLabel(closingBalance)}`
      ]);

      const worksheet = XLSX.utils.aoa_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Ledger");

      // Column widths
      worksheet["!cols"] = [
        { wch: 15 },
        { wch: 35 },
        { wch: 10 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 }
      ];

      XLSX.writeFile(workbook, `Ledger-${supplier.name}-${startDate}-to-${endDate}.xlsx`);
      toast.success("Excel Exported!");
    } catch (error) {
      console.error("Excel export failed:", error);
      toast.error("Failed to generate Excel");
    }
  };

  // Helper for formatting date
  const formatDate = (dateStr, includeTime = false) => {
    if (!dateStr) return "-";
    const options = { day: '2-digit', month: 'short', year: 'numeric' };
    if (includeTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
      options.hour12 = true;
    }
    return new Date(dateStr).toLocaleString('en-IN', {
      ...options,
      timeZone: 'Asia/Kolkata'
    });
  };

  const balanceColor = (bal) => bal > 0 ? "text-red-600" : bal < 0 ? "text-green-600" : "text-gray-800";
  const balanceLabel = (bal) => bal > 0 ? "Cr" : bal < 0 ? "Dr" : "";

  return (
    <div className="fixed inset-0 z-[100] flex justify-center items-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-900 to-teal-800 px-6 py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3 text-white">
            <div className="p-2 bg-white/20 rounded-lg">
              <FaFileInvoiceDollar size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold uppercase tracking-tight">Supplier Ledger</h2>
              <p className="text-teal-100 text-xs font-bold opacity-80 uppercase tracking-widest">{supplier.name}</p>
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
              onClick={handleExportExcel}
              className="px-4 py-2 bg-green-600/20 hover:bg-green-600/40 text-white rounded-lg transition-colors flex items-center gap-2 text-xs font-black border border-green-500/30 uppercase tracking-widest"
            >
              <FaDownload /> Export Excel
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
               className="bg-teal-700 text-white px-4 h-9 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-teal-800 transition shadow-md shadow-teal-700/20"
             >
               Sort By Date
             </button>
           </div>

           <div className="flex gap-4">
              <div className="text-right group relative">
                <div className="flex justify-between items-start">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Opening Balance</p>
                  {user?.role === "SUPER_ADMIN" && (
                    <button
                      onClick={() => { setEditingType('opening'); setEditValue(openingBalance.toString()); }}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-teal-600 transition ml-2"
                    >
                      <FaPencilAlt size={10} />
                    </button>
                  )}
                </div>
                {editingType === 'opening' ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      autoFocus
                      className="w-24 bg-white border border-gray-300 rounded px-2 py-1 text-xs font-black outline-none"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveBalance()}
                    />
                    <button onClick={handleSaveBalance} className="p-1.5 bg-teal-600 text-white rounded">
                      {savingBalance ? <FaSpinner className="animate-spin size-3" /> : <FaCheck size={10} />}
                    </button>
                    <button onClick={() => setEditingType(null)} className="p-1.5 bg-gray-200 text-gray-400 rounded">
                      <FaTimes size={10} />
                    </button>
                  </div>
                ) : (
                  <p className={`text-sm font-black ${balanceColor(openingBalance)}`}>₹{Math.abs(openingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {balanceLabel(openingBalance)}</p>
                )}
              </div>
              <div className="w-px h-8 bg-gray-300 mx-1"></div>
              <div className="text-right group relative">
                <div className="flex justify-between items-start">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Closing Balance</p>
                  {user?.role === "SUPER_ADMIN" && (
                    <button
                      onClick={() => { setEditingType('closing'); setEditValue(closingBalance.toString()); }}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-teal-600 transition ml-2"
                    >
                      <FaPencilAlt size={10} />
                    </button>
                  )}
                </div>
                {editingType === 'closing' ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      autoFocus
                      className="w-24 bg-white border border-gray-300 rounded px-2 py-1 text-xs font-black outline-none"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveBalance()}
                    />
                    <button onClick={handleSaveBalance} className="p-1.5 bg-teal-600 text-white rounded">
                      {savingBalance ? <FaSpinner className="animate-spin size-3" /> : <FaCheck size={10} />}
                    </button>
                    <button onClick={() => setEditingType(null)} className="p-1.5 bg-gray-200 text-gray-400 rounded">
                      <FaTimes size={10} />
                    </button>
                  </div>
                ) : (
                  <p className={`text-sm font-black ${balanceColor(closingBalance)}`}>₹{Math.abs(closingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {balanceLabel(closingBalance)}</p>
                )}
              </div>
           </div>
        </div>

        {/* Content */}
        <div id="vendor-ledger-content" className="flex-1 overflow-y-auto p-6 bg-white">
          {/* Header for PDF */}
          <div className="hidden pdf-only mb-8 text-center border-b-2 border-teal-800 pb-4">
             <h1 className="text-2xl font-black text-teal-800 uppercase underline">Supplier Account Ledger</h1>
             <h2 className="text-xl font-bold mt-2">{supplier.name}</h2>
             <p className="text-gray-500 font-bold text-xs mt-1">Period: {formatDate(startDate)} to {formatDate(endDate)}</p>
          </div>

          {/* Transactions Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-teal-50 border-b border-teal-100 text-teal-900 font-black uppercase text-[10px] tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Particulars</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4 text-right">Debit (Paid/Return)</th>
                    <th className="px-6 py-4 text-right">Credit (Billed)</th>
                    <th className="px-6 py-4 text-right bg-teal-100/50">Balance</th>
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
                    <td className="px-6 py-3 text-right font-black bg-teal-50/30 text-teal-900">
                      ₹{Math.abs(openingBalance).toLocaleString()} {balanceLabel(openingBalance)}
                    </td>
                  </tr>

                  {loading ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-20 text-center">
                        <FaSpinner className="animate-spin text-teal-600 text-3xl mx-auto mb-2" />
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Recalculating Balances...</p>
                      </td>
                    </tr>
                  ) : transactions.length > 0 ? (
                    transactions.map((txn, index) => (
                      <tr 
                        key={txn.id} 
                        className={`hover:bg-gray-50 transition-colors group ${txn.type === 'PAYMENT' ? 'bg-green-50/20' : txn.type === 'DEBIT_NOTE' ? 'bg-orange-50/20' : ''}`}
                      >
                        <td className="px-6 py-4 text-gray-600 text-xs font-bold whitespace-nowrap">
                          {formatDate(txn.date, true)}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-gray-800 text-xs uppercase tracking-tight">{txn.particulars}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${
                            txn.type === "INVOICE" ? "bg-red-100 text-red-700" : 
                            txn.type === "PAYMENT" ? "bg-green-100 text-green-700" : 
                            txn.type === "PAYMENT_RETURN" ? "bg-blue-100 text-blue-700" : 
                            txn.type.includes("JOURNAL") ? "bg-purple-100 text-purple-700" :
                            "bg-orange-100 text-orange-700"
                          }`}>
                            {txn.type === "JOURNAL_DR" ? "JOURNAL-DR" :
                             txn.type === "JOURNAL_CR" ? "JOURNAL-CR" : 
                             txn.type.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-green-600">
                          {txn.debit > 0 ? `₹${txn.debit.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "-"}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-gray-800">
                          {txn.credit > 0 ? `₹${txn.credit.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "-"}
                        </td>
                        <td className="px-6 py-4 text-right font-black bg-teal-50/30 text-teal-900 group-hover:scale-105 transition-transform duration-200">
                          ₹{Math.abs(txn.balance).toLocaleString()} {balanceLabel(txn.balance)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-gray-500 italic bg-gray-50/50">
                        No additional transactions found for this period
                      </td>
                    </tr>
                  )}

                  {/* Closing Balance Row */}
                  <tr className="bg-teal-900 text-white shadow-xl isolate z-10">
                    <td className="px-6 py-5">{formatDate(endDate)}</td>
                    <td className="px-6 py-5 font-black uppercase tracking-widest text-base">Closing Balance C/F</td>
                    <td className="px-6 py-5 uppercase font-bold text-xs opacity-70">C/B</td>
                    <td className="px-6 py-5 text-right font-bold">
                       ₹{transactions.reduce((sum, t) => sum + t.debit, 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-5 text-right font-bold">
                       ₹{transactions.reduce((sum, t) => sum + t.credit, 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-5 text-right font-black text-lg bg-white/10">
                      ₹{Math.abs(closingBalance).toLocaleString()} {balanceLabel(closingBalance)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Legend / Info */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
             <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-400"></div>
                <span>CR (Credit) means amount owed to supplier</span>
             </div>
             <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                <span>DR (Debit) means advance payment or overpayment</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorLedgerModal;
