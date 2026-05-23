import { useState, useEffect } from "react";
import { FaTimes, FaFileInvoiceDollar, FaDownload, FaCalendarAlt, FaSpinner } from "react-icons/fa";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import * as XLSX from 'xlsx';
import { API_BASE, fetchWithAuth } from "../../api";
import { toast } from "react-toastify";
import { useBranch } from "../../context/BranchContext";

const VendorLedgerModal = ({ isOpen, onClose, supplier: propSupplier }) => {
  const { user, branch } = useBranch();
  const [loading, setLoading] = useState(false);
  const [supplier, setSupplier] = useState(propSupplier);
  const [transactions, setTransactions] = useState([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);



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



  if (!isOpen || !supplier) return null;

  const handleExportPDF = async () => {
    const element = document.getElementById("formal-vendor-ledger-export");
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
      
      pdf.save(`Ledger-${supplier.name}-${startDate}-to-${endDate}.pdf`);
      toast.success("PDF Downloaded!", { id: "pdf-gen" });
    } catch (error) {
      console.error("PDF generation failed:", error);
      toast.error("Failed to generate PDF", { id: "pdf-gen" });
    }
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

  const totalDebit = transactions.reduce((sum, t) => sum + (t.debit || 0), 0);
  const totalCredit = transactions.reduce((sum, t) => sum + (t.credit || 0), 0);

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
              <div className="flex items-center gap-2">
                <p className="text-[10px] opacity-70 uppercase font-black tracking-widest">{supplier?.name || "Loading..."}</p>
                {transactions.some(t => ["SALES_INVOICE", "CUSTOMER_RECEIPT", "CREDIT_NOTE"].includes(t.type)) && (
                  <span className="bg-amber-400 text-amber-950 text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter animate-pulse shadow-lg shadow-amber-400/20">
                    Consolidated Account
                  </span>
                )}
              </div>
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
              <div className="text-right">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Opening Balance</p>
                <p className={`text-sm font-black ${balanceColor(openingBalance)}`}>₹{Math.abs(openingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {balanceLabel(openingBalance)}</p>
              </div>
              <div className="w-px h-8 bg-gray-300 mx-1"></div>
              <div className="text-right">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Closing Balance</p>
                <p className={`text-sm font-black ${balanceColor(closingBalance)}`}>₹{Math.abs(closingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {balanceLabel(closingBalance)}</p>
              </div>
           </div>
        </div>

        {/* Content */}
        <div id="vendor-ledger-content" className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50">
          
          {/* 1. OFF-SCREEN FORMAL EXPORT TEMPLATE (HIDDEN FROM UI) */}
          <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '800px', background: 'white' }}>
            <div id="formal-vendor-ledger-export" className="p-10 formal-ledger">
               <style>
                 {`
                   .formal-ledger { font-family: 'Times New Roman', Times, serif; color: #000; padding: 20px; }
                   .formal-h { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
                   .formal-c-info { flex: 1; text-align: center; }
                   .formal-c-name { font-size: 28px; font-weight: bold; text-transform: uppercase; margin-bottom: 5px; }
                   .formal-c-addr { font-size: 13px; line-height: 1.4; font-weight: normal; }
                   
                   .formal-sb-box { display: flex; border: 1.5px solid #000; margin-bottom: 20px; }
                   .formal-sb-half { flex: 1; padding: 12px; font-size: 13px; line-height: 1.5; }
                   .formal-sb-half:first-child { border-right: 1.5px solid #000; }
                   .formal-sb-lab { font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #000; margin-bottom: 5px; padding-bottom: 2px; display: block; font-size: 11px; }
                   
                   .formal-t { width: 100%; border-collapse: collapse; border: 1.5px solid #000; font-size: 13px; margin-bottom: 1px; }
                   .formal-t th { border: 1px solid #000; padding: 10px 5px; background: #f0f0f0; font-weight: bold; text-transform: uppercase; text-align: center; }
                   .formal-t td { border: 1px solid #000; padding: 6px 6px 8px 6px; vertical-align: middle; font-weight: normal; line-height: 1.3; }
                   
                   .formal-sum-bar { display: flex; border: 1.5px solid #000; border-top: none; background: #fff; color: #000; font-weight: bold; font-size: 14px; }
                   
                   .v-c { font-weight: bold; font-size: 11px; display: inline-block; }
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
                  <span style={{ fontWeight: 'bold', textTransform: 'uppercase', textDecoration: 'underline', fontSize: '16px' }}>Supplier Ledger Account</span>
               </div>

               <div className="formal-sb-box">
                  <div className="formal-sb-half">
                    <span className="formal-sb-lab">Supplier Details</span>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#000' }}>{supplier.name}</div>
                    <div>{supplier.address}</div>
                    <div>Phone: {supplier.phone}</div>
                    <div>GSTIN: {supplier.gstin || "Unregistered"}</div>
                  </div>
                  <div className="formal-sb-half">
                    <span className="formal-sb-lab">Period Covered</span>
                    <div style={{ fontWeight: 'bold', fontStyle: 'italic' }}>{formatDate(startDate)} TO {formatDate(endDate)}</div>
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
                      <td style={{ fontWeight: 'bold' }}>OPENING BALANCE B/F</td>
                      <td style={{ textAlign: 'center' }}>O/B</td>
                      <td style={{ textAlign: 'right' }}>-</td>
                      <td style={{ textAlign: 'right' }}>-</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{Math.abs(openingBalance).toLocaleString()} {balanceLabel(openingBalance)}</td>
                    </tr>
                    {transactions.map((txn, idx) => {
                       return (
                         <tr key={txn.id}>
                           <td style={{ textAlign: 'center' }}>{idx+1}</td>
                           <td style={{ textAlign: 'center' }}>{formatDate(txn.date)}</td>
                           <td><span style={{ fontWeight: 'normal' }}>{txn.particulars}</span></td>
                           <td style={{ textAlign: 'center' }}><span className="v-c">{txn.type === "JOURNAL_DR" ? "JRNL-DR" : txn.type === "JOURNAL_CR" ? "JRNL-CR" : txn.type.replace("_", " ")}</span></td>
                           <td style={{ textAlign: 'right', fontWeight: 'normal', color: '#15803d' }}>{txn.debit > 0 ? `₹${txn.debit.toLocaleString()}` : "-"}</td>
                           <td style={{ textAlign: 'right', fontWeight: 'normal', color: '#b91c1c' }}>{txn.credit > 0 ? `₹${txn.credit.toLocaleString()}` : "-"}</td>
                           <td style={{ textAlign: 'right', fontWeight: 'normal' }}>₹{Math.abs(txn.balance).toLocaleString()} {balanceLabel(txn.balance)}</td>
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
                    <p className={`text-lg font-black ${closingBalance >= 0 ? 'text-red-500' : 'text-indigo-600'}`}>
                      ₹{Math.abs(closingBalance).toLocaleString()} {balanceLabel(closingBalance)}
                    </p>
                 </div>
              </div>
            </div>

          {/* Transactions Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-900 text-white font-black uppercase text-[10px] tracking-[0.2em]">
                  <tr>
                    <th className="px-6 py-5">No</th>
                    <th className="px-6 py-5">Date</th>
                    <th className="px-6 py-5">Particulars</th>
                    <th className="px-6 py-5">Type</th>
                    <th className="px-6 py-5 text-right">Debit (₹)</th>
                    <th className="px-6 py-5 text-right">Credit (₹)</th>
                    <th className="px-6 py-5 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-bold">
                  {/* Opening Balance Row */}
                  <tr className="bg-indigo-50/30">
                    <td className="px-6 py-4 text-slate-300">-</td>
                    <td className="px-6 py-4 text-slate-500">{formatDate(startDate)}</td>
                    <td className="px-6 py-4 text-indigo-900 font-black uppercase tracking-wide">Opening Balance B/F</td>
                    <td className="px-6 py-4 text-indigo-300">O/B</td>
                    <td className="px-6 py-4 text-right">-</td>
                    <td className="px-6 py-4 text-right">-</td>
                    <td className="px-6 py-4 text-right font-black text-indigo-700">
                      ₹{Math.abs(openingBalance).toLocaleString()} {balanceLabel(openingBalance)}
                    </td>
                  </tr>

                  {loading ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-20 text-center">
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
                        <td className="px-6 py-4 text-slate-400">{index + 1}</td>
                        <td className="px-6 py-4 text-slate-600 text-xs font-bold whitespace-nowrap">
                          {formatDate(txn.date, true)}
                        </td>
                        <td className="px-6 py-4">
                           <span className="text-slate-900 font-black group-hover:text-blue-600 transition-colors uppercase tracking-tight">{txn.particulars}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-lg text-[10px] uppercase font-black tracking-widest ${
                            txn.type === "INVOICE" ? "bg-red-100 text-red-600" : 
                            txn.type === "SALES_INVOICE" ? "bg-indigo-100 text-indigo-600 border border-indigo-200" :
                            txn.type === "CREDIT_NOTE" ? "bg-indigo-50 text-indigo-500 border border-indigo-100" :
                            txn.type === "CUSTOMER_RECEIPT" ? "bg-indigo-50 text-indigo-400 border border-indigo-100" :
                            txn.type === "PAYMENT" ? "bg-green-100 text-green-600" : 
                            txn.type === "PAYMENT_RETURN" ? "bg-blue-100 text-blue-600" : 
                            txn.type.includes("JOURNAL") ? "bg-purple-100 text-purple-600" :
                            "bg-orange-100 text-orange-600"
                          }`}>
                            {txn.type === "JOURNAL_DR" ? "JOURNAL-DR" :
                             txn.type === "JOURNAL_CR" ? "JOURNAL-CR" : 
                             txn.type === "SALES_INVOICE" ? "SALES" :
                             txn.type === "CREDIT_NOTE" ? "RETURN" :
                             txn.type === "CUSTOMER_RECEIPT" ? "RECEIPT" :
                             txn.type.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-green-600">
                          {txn.debit > 0 ? `₹${txn.debit.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "-"}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-red-600">
                          {txn.credit > 0 ? `₹${txn.credit.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "-"}
                        </td>
                        <td className="px-6 py-4 text-right font-black text-slate-900 group-hover:scale-105 transition-transform duration-200">
                          ₹{Math.abs(txn.balance).toLocaleString()} {balanceLabel(txn.balance)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="px-6 py-12 text-center text-gray-500 italic bg-gray-50/50">
                        No additional transactions found for this period
                      </td>
                    </tr>
                  )}

                  {/* Summary Totals Row */}
                  <tr className="bg-slate-900 text-white">
                    <td colSpan={4} className="px-6 py-6 text-right uppercase tracking-widest text-xs opacity-60">Period Totals</td>
                    <td className="px-6 py-6 text-right font-black text-green-300">₹{totalDebit.toLocaleString()}</td>
                    <td className="px-6 py-6 text-right font-black text-red-300">₹{totalCredit.toLocaleString()}</td>
                    <td className="px-6 py-6 text-right font-black bg-white/20">₹{Math.abs(closingBalance).toLocaleString()} {balanceLabel(closingBalance)}</td>
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
