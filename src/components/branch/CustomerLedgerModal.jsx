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
    const element = document.getElementById("formal-ledger-export");
    if (!element) return toast.error("Export template not found");

    toast.loading("Preparing multi-page PDF...", { id: "pdf-gen" });

    try {
      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      
      const imgWidth = 210; 
      const pageHeight = 295; // Slightly less than 297 to avoid tight margins
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      // Add subsequent pages if needed
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }
      
      pdf.save(`Ledger-${customer.name}-${startDate}-to-${endDate}.pdf`);
      toast.success("PDF Downloaded!", { id: "pdf-gen" });
    } catch (error) {
      console.error("PDF generation failed:", error);
      toast.error("Failed to generate PDF", { id: "pdf-gen" });
    }
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
        <div id="customer-ledger-content" className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50">
          
          {/* 1. OFF-SCREEN FORMAL EXPORT TEMPLATE (HIDDEN FROM UI) */}
          <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '800px', background: 'white' }}>
            <div id="formal-ledger-export" className="p-10 formal-ledger">
               <style>
                 {`
                   .formal-ledger { font-family: 'Times New Roman', Times, serif; color: #000; padding: 20px; }
                   .formal-h { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
                   .formal-c-info { flex: 1; text-align: center; }
                   .formal-c-name { font-size: 28px; font-weight: 900; text-transform: uppercase; margin-bottom: 5px; }
                   .formal-c-addr { font-size: 13px; line-height: 1.4; font-weight: 600; }
                   
                   .formal-sb-box { display: flex; border: 1.5px solid #000; margin-bottom: 20px; }
                   .formal-sb-half { flex: 1; padding: 12px; font-size: 13px; line-height: 1.5; }
                   .formal-sb-half:first-child { border-right: 1.5px solid #000; }
                   .formal-sb-lab { font-weight: 900; text-transform: uppercase; border-bottom: 1px solid #000; margin-bottom: 5px; padding-bottom: 2px; display: block; font-size: 11px; }
                   
                   .formal-t { width: 100%; border-collapse: collapse; border: 1.5px solid #000; font-size: 13px; margin-bottom: 1px; }
                   .formal-t th { border: 1px solid #000; padding: 10px 5px; background: #f0f0f0; font-weight: 900; text-transform: uppercase; text-align: center; }
                   .formal-t td { border: 1px solid #000; padding: 6px 6px 8px 6px; vertical-align: middle; font-weight: 700; line-height: 1.3; }
                   
                   .formal-sum-bar { display: flex; border: 1.5px solid #000; border-top: none; background: #fff; color: #000; font-weight: 900; font-size: 14px; }
                   .formal-sum-item { padding: 10px; border-right: 1.5px solid #000; }
                   
                   .v-c { font-weight: 900; font-size: 11px; display: inline-block; }
                 `}
               </style>

               <div className="formal-h">
                  <img src={branch?.logo || "/logo.jpeg"} alt="Logo" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
                  <div className="formal-c-info">
                    <div className="formal-c-name">{branch?.name || "PEARL AGENCY"}</div>
                    <div className="formal-c-addr">
                      {branch?.address}<br/>
                      {branch?.city}, {branch?.state} - {branch?.pincode}<br/>
                      GSTIN: {branch?.gstin || "N/A"} | PH: {branch?.phone || "N/A"}
                    </div>
                  </div>
                  <div style={{ width: '80px' }}></div>
               </div>

               <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                  <span style={{ fontWeight: 900, textTransform: 'uppercase', textDecoration: 'underline', fontSize: '16px' }}>Customer Ledger Account</span>
               </div>

               <div className="formal-sb-box">
                  <div className="formal-sb-half">
                    <span className="formal-sb-lab">Account Details</span>
                    <div style={{ fontSize: '14px', fontWeight: 900, color: '#000' }}>{customer.name}</div>
                    <div>{customer.address}</div>
                    <div>WhatsApp: {customer.whatsapp}</div>
                    <div>GSTIN: {customer.gstin || "Unregistered"}</div>
                  </div>
                  <div className="formal-sb-half">
                    <span className="formal-sb-lab">Period Covered</span>
                    <div style={{ fontWeight: 900, fontStyle: 'italic' }}>{formatDate(startDate)} TO {formatDate(endDate)}</div>
                    <div style={{ marginTop: '10px', fontSize: '10px', opacity: 0.6 }}>Generated on: {new Date().toLocaleString()}</div>
                  </div>
               </div>

               <table className="formal-t">
                  <thead>
                    <tr>
                      <th style={{ width: '30px' }}>No</th>
                      <th style={{ width: '100px' }}>Date</th>
                      <th>Particulars / Ref No</th>
                      <th style={{ width: '50px' }}>Type</th>
                      <th style={{ width: '90px' }} className="text-right">Debit</th>
                      <th style={{ width: '90px' }} className="text-right">Credit</th>
                      <th style={{ width: '100px' }} className="text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ background: '#f5f5f5', fontStyle: 'italic' }}>
                      <td style={{ textAlign: 'center' }}>-</td>
                      <td style={{ textAlign: 'center' }}>{formatDate(startDate)}</td>
                      <td style={{ fontWeight: 900 }}>OPENING BALANCE B/F</td>
                      <td style={{ textAlign: 'center' }}>O/B</td>
                      <td style={{ textAlign: 'right' }}>-</td>
                      <td style={{ textAlign: 'right' }}>-</td>
                      <td style={{ textAlign: 'right', fontWeight: 900 }}>₹{Math.abs(openingBalance).toLocaleString()} {balanceLabel(openingBalance)}</td>
                    </tr>
                    {transactions.map((txn, idx) => {
                       let docId = "-";
                       const pm = txn.particulars?.match(/(?:Invoice|Receipt|Note):\s*([^\s(]+)/i);
                       if (pm) docId = pm[1]; else if (txn.type === "INVOICE") docId = txn.particulars.split(": ")[1] || "-";
                       
                       // Extraction for Mode / Voucher Type
                       let vt = "-";
                       if (txn.type === "INVOICE") vt = "Z-1";
                       else if (txn.type === "RECEIPT") {
                         const modeMatch = txn.particulars?.match(/\(([^)]+)\)/);
                         vt = modeMatch ? modeMatch[1].toUpperCase() : "CASH";
                       } else if (txn.type === "CREDIT_NOTE") vt = "Z-2";
                       else vt = "B-X";

                       return (
                         <tr key={txn.id}>
                           <td style={{ textAlign: 'center' }}>{idx+1}</td>
                           <td style={{ textAlign: 'center' }}>{formatDate(txn.date)}</td>
                           <td><span style={{ fontWeight: 900 }}>{docId}</span></td>
                           <td style={{ textAlign: 'center' }}><span className="v-c">{vt}</span></td>
                           <td style={{ textAlign: 'right', fontWeight: 900, color: '#b91c1c' }}>{txn.debit > 0 ? `₹${txn.debit.toLocaleString()}` : "-"}</td>
                           <td style={{ textAlign: 'right', fontWeight: 900, color: '#15803d' }}>{txn.credit > 0 ? `₹${txn.credit.toLocaleString()}` : "-"}</td>
                           <td style={{ textAlign: 'right', fontWeight: 900 }}>₹{Math.abs(txn.balance).toLocaleString()} {balanceLabel(txn.balance)}</td>
                         </tr>
                       )
                    })}
                  </tbody>
               </table>
               <div className="formal-sum-bar">
                  <div style={{ flex: 1, textAlign: 'right', padding: '10px', borderRight: '1.5px solid #000' }}>PERIOD TOTALS:</div>
                  <div style={{ width: '90px', textAlign: 'right', padding: '10px', borderRight: '1.5px solid #000' }}>₹{totalDebit.toLocaleString()}</div>
                  <div style={{ width: '90px', textAlign: 'right', padding: '10px', borderRight: '1.5px solid #000' }}>₹{totalCredit.toLocaleString()}</div>
                  <div style={{ width: '100px', textAlign: 'right', padding: '10px' }}>₹{Math.abs(closingBalance).toLocaleString()} {balanceLabel(closingBalance)}</div>
               </div>
               <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '10px', fontStyle: 'italic' }}>E.&amp;O.E.</div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', fontWeight: 900, marginBottom: '40px' }}>for {branch?.name || "PEARL AGENCY"}</div>
                    <div style={{ borderTop: '1px solid #000', width: '150px', fontSize: '10px', fontWeight: 900, paddingTop: '5px' }}>Authorised Signatory</div>
                  </div>
               </div>
            </div>
          </div>

          {/* 2. ON-SCREEN MODERN UI (AS USUAL) */}
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            {/* Live Filter Bar Placeholder */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Statement Ledger</h3>
                <p className="text-xs text-slate-400 font-bold tracking-widest uppercase mt-1">Transaction History</p>
              </div>
              <div className="flex gap-4">
                 <div className="px-4 py-2 bg-white rounded-xl border border-slate-100 shadow-sm text-right">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">Current Balance</p>
                    <p className={`text-lg font-black ${closingBalance >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>
                      ₹{Math.abs(closingBalance).toLocaleString()} {balanceLabel(closingBalance)}
                    </p>
                 </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-900 text-white font-black uppercase text-[10px] tracking-[0.2em]">
                  <tr>
                    <th className="px-6 py-5">S.No</th>
                    <th className="px-6 py-5">Date</th>
                    <th className="px-6 py-5">Invoice Number</th>
                    <th className="px-6 py-5">Voucher Type</th>
                    <th className="px-6 py-5 text-right">Debit (₹)</th>
                    <th className="px-6 py-5 text-right">Credit (₹)</th>
                    <th className="px-6 py-5 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="font-bold divide-y divide-slate-100">
                  {/* Opening Balance */}
                  <tr className="bg-indigo-50/30">
                    <td className="px-6 py-4 text-slate-300">-</td>
                    <td className="px-6 py-4 text-slate-500">{formatDate(startDate)}</td>
                    <td className="px-6 py-4 text-indigo-900 font-black">OPENING BALANCE B/F</td>
                    <td className="px-6 py-4 text-indigo-300">O/B</td>
                    <td className="px-6 py-4 text-right">-</td>
                    <td className="px-6 py-4 text-right">-</td>
                    <td className="px-6 py-4 text-right font-black text-indigo-700">₹{Math.abs(openingBalance).toLocaleString()} {balanceLabel(openingBalance)}</td>
                  </tr>

                  {transactions.map((txn, index) => {
                    let docId = "-";
                    const pm = txn.particulars?.match(/(?:Invoice|Receipt|Note):\s*([^\s(]+)/i);
                    if (pm) docId = pm[1]; else if (txn.type === "INVOICE") docId = txn.particulars.split(": ")[1] || "-";

                    return (
                      <tr key={txn.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-6 py-4 text-slate-400">{index + 1}</td>
                        <td className="px-6 py-4 text-slate-600">{formatDate(txn.date)}</td>
                        <td className="px-6 py-4">
                          <span className="text-slate-900 font-black group-hover:text-blue-600 transition-colors">{docId}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-lg text-[10px] uppercase font-black tracking-widest ${
                            txn.type === "INVOICE" ? "bg-red-100 text-red-600" : 
                            txn.type === "RECEIPT" ? "bg-green-100 text-green-600" : 
                            "bg-purple-100 text-purple-600"
                          }`}>
                            {txn.type === "RECEIPT" ? (txn.particulars?.match(/\(([^)]+)\)/)?.[1]?.toUpperCase() || "CASH") : (txn.type === "INVOICE" ? "Z-1" : (txn.type === "CREDIT_NOTE" ? "Z-2" : txn.type))}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-red-500 font-bold">{txn.debit > 0 ? `₹${txn.debit.toLocaleString()}` : "-"}</td>
                        <td className="px-6 py-4 text-right text-green-600 font-bold">{txn.credit > 0 ? `₹${txn.credit.toLocaleString()}` : "-"}</td>
                        <td className="px-6 py-4 text-right font-black text-slate-900">₹{Math.abs(txn.balance).toLocaleString()} {balanceLabel(txn.balance)}</td>
                      </tr>
                    );
                  })}

                  {/* Summary Totals */}
                  <tr className="bg-slate-900 text-white">
                    <td colSpan={4} className="px-6 py-6 text-right uppercase tracking-widest text-xs opacity-60">Period Totals</td>
                    <td className="px-6 py-6 text-right font-black text-red-300">₹{totalDebit.toLocaleString()}</td>
                    <td className="px-6 py-6 text-right font-black text-green-300">₹{totalCredit.toLocaleString()}</td>
                    <td className="px-6 py-6 text-right font-black bg-white/20">₹{Math.abs(closingBalance).toLocaleString()} {balanceLabel(closingBalance)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* DR/CR Explainer */}
          <div className="mt-8 flex gap-8 justify-center">
             <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <div className="w-3 h-3 rounded-full bg-red-400"></div> DEBIT (DR) = OWED TO US
             </div>
             <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <div className="w-3 h-3 rounded-full bg-green-400"></div> CREDIT (CR) = RECEIVED
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerLedgerModal;
