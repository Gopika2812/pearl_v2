import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  FaFileInvoiceDollar, FaDownload, FaCalendarAlt, 
  FaSpinner, FaPencilAlt, FaCheck, FaTimes, 
  FaArrowLeft, FaUser, FaTruck 
} from "react-icons/fa";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import * as XLSX from 'xlsx';
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";
import { toast } from "react-toastify";

const BranchCustomerLedger = () => {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const { currentBranch: branch } = useBranch();
  
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState(null);
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
    if (customerId) {
      fetchCustomerDetails();
    }
  }, [customerId]);

  useEffect(() => {
    if (customerId) {
      fetchLedger();
    }
  }, [customerId, startDate, endDate]);

  const fetchCustomerDetails = async () => {
    try {
      const response = await fetchWithAuth(`${API_BASE}/customers/${customerId}`);
      const data = await response.json();
      if (response.ok) {
        setCustomer(data);
      } else {
        toast.error("Customer not found");
        navigate("/branch/customers");
      }
    } catch (err) {
      console.error("Error fetching customer:", err);
      toast.error("Failed to load customer details");
    }
  };

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/customers/${customerId}/ledger?startDate=${startDate}&endDate=${endDate}`);
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
        fetchCustomerDetails(); // Update local customer state
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
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }
      
      pdf.save(`Ledger-${customer?.name}-${startDate}-to-${endDate}.pdf`);
      toast.success("PDF Downloaded!", { id: "pdf-gen" });
    } catch (error) {
      console.error("PDF generation failed:", error);
      toast.error("Failed to generate PDF", { id: "pdf-gen" });
    }
  };

  const handleExportExcel = () => {
    try {
      const data = [];
      data.push([branch?.name || "PEARL AGENCY"]);
      data.push([branch?.address || ""]);
      data.push([`Customer: ${customer?.name}`]);
      data.push([`Date: ${formatDate(startDate)} TO ${formatDate(endDate)}`]);
      data.push([]); 

      // Table Header
      data.push(["Date", "Particulars / Ref No", "Type", "User", "Delivery Man", "Debit", "Credit", "Balance"]);

      // Opening Balance
      data.push([
        formatDate(startDate),
        "OPENING BALANCE B/F",
        "O/B",
        "-",
        "-",
        0,
        0,
        `${Math.abs(openingBalance).toLocaleString()} ${balanceLabel(openingBalance)}`
      ]);

      // Transactions
      transactions.forEach(txn => {
        let docId = "-";
        const invMatch = txn.particulars?.match(/for Inv:\s*([^\s(]+)/i);
        const pm = txn.particulars?.match(/(?:Invoice|Receipt|Note):\s*([^\s(]+)/i);
        
        if (invMatch) docId = invMatch[1];
        else if (pm) docId = pm[1]; 
        else if (txn.type === "INVOICE") docId = txn.particulars.split(": ")[1] || "-";

        let vt = "-";
        if (txn.type === "INVOICE") vt = "Z-1";
        else if (txn.type === "RECEIPT") {
          const modeMatch = txn.particulars?.match(/\(([^)]+)\)/);
          vt = modeMatch ? modeMatch[1].toUpperCase() : "CASH";
        } else if (txn.type === "CREDIT_NOTE") vt = "Z-2";
        else vt = "B-X";

        data.push([
          formatDate(txn.date),
          docId,
          vt,
          txn.user || "-",
          txn.deliveryMan || "-",
          txn.debit || 0,
          txn.credit || 0,
          `${Math.abs(txn.balance).toLocaleString()} ${balanceLabel(txn.balance)}`
        ]);
      });

      // Period Totals
      data.push([]);
      data.push([
        "PERIOD TOTALS",
        "",
        "",
        "",
        "",
        totalDebit,
        totalCredit,
        `${Math.abs(closingBalance).toLocaleString()} ${balanceLabel(closingBalance)}`
      ]);

      const worksheet = XLSX.utils.aoa_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Ledger");

      worksheet["!cols"] = [
        { wch: 15 }, { wch: 30 }, { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 15 }
      ];

      XLSX.writeFile(workbook, `Ledger-${customer?.name}-${startDate}-to-${endDate}.xlsx`);
      toast.success("Excel Exported!");
    } catch (error) {
      console.error("Excel export failed:", error);
      toast.error("Failed to generate Excel");
    }
  };

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
  const balanceLabel = (bal) => bal > 0 ? "Dr" : bal < 0 ? "Cr" : "";

  const totalDebit = transactions.reduce((sum, t) => sum + t.debit, 0);
  const totalCredit = transactions.reduce((sum, t) => sum + t.credit, 0);

  if (!customer) return null;

  return (
    <div className="space-y-6">
      {/* PREMIUM HEADER */}
      <div className="relative overflow-hidden bg-white/50 backdrop-blur-md p-8 rounded-3xl border border-white/50 shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
        
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <button 
              onClick={() => navigate(-1)}
              className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:shadow-lg transition-all border border-slate-100"
            >
              <FaArrowLeft />
            </button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-widest rounded-md">Finance</span>
                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Customer Ledger</span>
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none uppercase italic">
                {customer.name} <span className="text-indigo-600 not-italic">Ledger</span>
              </h1>
              <p className="text-slate-500 text-sm font-semibold mt-1">Full transaction history and automated financial reconciliation</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={handleExportPDF}
              className="group flex items-center gap-3 bg-white border border-slate-200 text-slate-700 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all shadow-lg hover:-translate-y-0.5 active:translate-y-0"
            >
              <FaDownload className="text-indigo-500" /> PDF
            </button>
            <button
              onClick={handleExportExcel}
              className="group flex items-center gap-3 bg-white border border-slate-200 text-slate-700 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all shadow-lg hover:-translate-y-0.5 active:translate-y-0"
            >
              <FaDownload className="text-emerald-500" /> Excel
            </button>
          </div>
        </div>
      </div>

      {/* QUICK STATS & FILTERS */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters */}
        <div className="lg:col-span-2 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="flex-1 flex items-center bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 shadow-inner">
            <FaCalendarAlt className="text-slate-400 mr-3" />
            <input 
              type="date" 
              className="bg-transparent text-xs font-black text-slate-600 outline-none w-full"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span className="mx-2 text-slate-300 text-xs font-black">TO</span>
            <input 
              type="date" 
              className="bg-transparent text-xs font-black text-slate-600 outline-none w-full"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <button 
            onClick={fetchLedger}
            className="bg-slate-900 text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition shadow-xl shadow-slate-900/20"
          >
            Filter
          </button>
        </div>

        {/* Balance Cards */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm group">
          <div className="flex justify-between items-start mb-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Opening Balance</p>
            <button 
              onClick={() => { setEditingType('opening'); setEditValue(openingBalance.toString()); }}
              className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-indigo-600 transition"
            >
              <FaPencilAlt size={10} />
            </button>
          </div>
          {editingType === 'opening' ? (
            <div className="flex items-center gap-2 mt-2">
              <input 
                type="number"
                autoFocus
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-black outline-none"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveBalance()}
              />
              <button onClick={handleSaveBalance} className="p-2 bg-indigo-600 text-white rounded-xl">
                {savingBalance ? <FaSpinner className="animate-spin" /> : <FaCheck size={12} />}
              </button>
              <button onClick={() => setEditingType(null)} className="p-2 bg-slate-100 text-slate-400 rounded-xl">
                <FaTimes size={12} />
              </button>
            </div>
          ) : (
            <p className={`text-2xl font-black tracking-tight leading-none ${balanceColor(openingBalance)}`}>
              ₹{Math.abs(openingBalance).toLocaleString()} <span className="text-xs uppercase opacity-60 underline decoration-slate-200">{balanceLabel(openingBalance)}</span>
            </p>
          )}
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm group">
          <div className="flex justify-between items-start mb-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Closing Balance</p>
            <button 
              onClick={() => { setEditingType('closing'); setEditValue(closingBalance.toString()); }}
              className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-indigo-600 transition"
            >
              <FaPencilAlt size={10} />
            </button>
          </div>
          {editingType === 'closing' ? (
            <div className="flex items-center gap-2 mt-2">
              <input 
                type="number"
                autoFocus
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-black outline-none"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveBalance()}
              />
              <button onClick={handleSaveBalance} className="p-2 bg-indigo-600 text-white rounded-xl">
                {savingBalance ? <FaSpinner className="animate-spin" /> : <FaCheck size={12} />}
              </button>
              <button onClick={() => setEditingType(null)} className="p-2 bg-slate-100 text-slate-400 rounded-xl">
                <FaTimes size={12} />
              </button>
            </div>
          ) : (
            <p className={`text-2xl font-black tracking-tight leading-none ${balanceColor(closingBalance)}`}>
              ₹{Math.abs(closingBalance).toLocaleString()} <span className="text-xs uppercase opacity-60 underline decoration-slate-200">{balanceLabel(closingBalance)}</span>
            </p>
          )}
        </div>
      </div>

      {/* TRANSACTION TABLE */}
      <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/60 border border-white overflow-hidden p-2">
        {loading ? (
          <div className="p-32 text-center bg-slate-50/50 rounded-[2rem]">
            <div className="w-16 h-16 border-4 border-slate-100 border-t-indigo-500 rounded-full animate-spin mx-auto mb-6"></div>
            <p className="text-slate-400 font-black uppercase text-[10px] tracking-[0.2em]">Processing Ledger Data...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] font-black tracking-[0.2em]">
                <tr>
                  <th className="px-8 py-6 text-left rounded-tl-[2rem]">No</th>
                  <th className="px-6 py-6 text-left">Date</th>
                  <th className="px-6 py-6 text-left">Particulars / Ref</th>
                  <th className="px-6 py-6 text-center">Type</th>
                  <th className="px-6 py-6 text-left"><div className="flex items-center gap-2"><FaUser size={10} className="text-indigo-400"/> User</div></th>
                  <th className="px-6 py-6 text-left"><div className="flex items-center gap-2"><FaTruck size={10} className="text-indigo-400"/> Delivery</div></th>
                  <th className="px-6 py-6 text-right">Debit (Dr)</th>
                  <th className="px-6 py-6 text-right">Credit (Cr)</th>
                  <th className="px-8 py-6 text-right rounded-tr-[2rem]">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-bold">
                {/* Opening Balance Row */}
                <tr className="bg-slate-50 font-black text-slate-400">
                  <td className="px-8 py-4">-</td>
                  <td className="px-6 py-4">{formatDate(startDate)}</td>
                  <td className="px-6 py-4 italic">OPENING BALANCE B/F</td>
                  <td className="px-6 py-4 text-center">O/B</td>
                  <td className="px-6 py-4">-</td>
                  <td className="px-6 py-4">-</td>
                  <td className="px-6 py-4 text-right">-</td>
                  <td className="px-6 py-4 text-right">-</td>
                  <td className={`px-8 py-4 text-right ${balanceColor(openingBalance)}`}>₹{Math.abs(openingBalance).toLocaleString()} {balanceLabel(openingBalance)}</td>
                </tr>

                {transactions.map((txn, index) => {
                  let docId = "-";
                  const invMatch = txn.particulars?.match(/for Inv:\s*([^\s(]+)/i);
                  const pm = txn.particulars?.match(/(?:Invoice|Receipt|Note):\s*([^\s(]+)/i);
                  
                  if (invMatch) docId = invMatch[1];
                  else if (pm) docId = pm[1]; 
                  else if (txn.type === "INVOICE") docId = txn.particulars.split(": ")[1] || "-";

                  return (
                    <tr key={txn.id} className="hover:bg-slate-50/80 transition-all duration-300 group cursor-default">
                      <td className="px-8 py-6 text-slate-300 group-hover:text-indigo-400 transition-colors">{index + 1}</td>
                      <td className="px-6 py-6 text-slate-500 whitespace-nowrap">{formatDate(txn.date, true)}</td>
                      <td className="px-6 py-6">
                        <div className={`text-slate-800 group-hover:text-slate-900 transition-colors uppercase tracking-tight ${txn.type === 'CANCELLED' ? 'line-through text-slate-400' : ''}`}>{docId}</div>
                        <div className={`text-[10px] text-slate-400 font-bold italic truncate max-w-[200px] mt-0.5 ${txn.type === 'CANCELLED' ? 'line-through' : ''}`}>{txn.particulars}</div>
                      </td>
                      <td className="px-6 py-6 text-center">
                        <span className={`px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider shadow-sm border ${
                          txn.type === "INVOICE" ? "bg-rose-50 text-rose-600 border-rose-100" : 
                          txn.type === "RECEIPT" || txn.type === "BOUNCED" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : 
                          txn.type === "CANCELLED" ? "bg-slate-100 text-slate-400 border-slate-200" :
                          "bg-indigo-50 text-indigo-600 border-indigo-100"
                        }`}>
                          {txn.type === "RECEIPT" ? (txn.particulars?.match(/\(([^)]+)\)/)?.[1]?.toUpperCase() || "CASH") : txn.type}
                        </span>
                      </td>
                      <td className="px-6 py-6">
                         <div className="text-[12px] text-slate-700">{txn.user || "-"}</div>
                      </td>
                      <td className="px-6 py-6">
                         <div className="text-[12px] text-slate-700">{txn.deliveryMan || "-"}</div>
                      </td>
                      <td className="px-6 py-6 text-right">
                        {txn.debit > 0 ? (
                          <div className="text-[13px] font-bold text-rose-600">₹{txn.debit.toLocaleString()}</div>
                        ) : "-"}
                      </td>
                      <td className="px-6 py-6 text-right">
                        {txn.credit > 0 ? (
                          <div className="text-[13px] font-bold text-emerald-600">₹{txn.credit.toLocaleString()}</div>
                        ) : txn.type === "CANCELLED" ? (
                          <div className="text-[13px] font-bold text-slate-400 line-through">₹{txn.originalAmount?.toLocaleString()}</div>
                        ) : "-"}
                      </td>
                      <td className={`px-8 py-6 text-right font-black text-[14px] ${balanceColor(txn.balance)}`}>
                        ₹{Math.abs(txn.balance).toLocaleString()} <span className="text-[10px] opacity-40">{balanceLabel(txn.balance)}</span>
                      </td>
                    </tr>
                  );
                })}

                {/* Period Totals */}
                <tr className="bg-slate-900 text-white shadow-2xl">
                  <td colSpan={6} className="px-6 py-8 text-right uppercase tracking-[0.3em] text-[10px] opacity-50">Period Totals</td>
                  <td className="px-6 py-8 text-right font-black text-rose-300 text-base">₹{totalDebit.toLocaleString()}</td>
                  <td className="px-6 py-8 text-right font-black text-emerald-300 text-base">₹{totalCredit.toLocaleString()}</td>
                  <td className="px-8 py-8 text-right font-black bg-white/10 text-lg">₹{Math.abs(closingBalance).toLocaleString()} <span className="text-xs opacity-50">{balanceLabel(closingBalance)}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* OFF-SCREEN EXPORT TEMPLATE */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '1000px', background: 'white' }}>
        <div id="formal-ledger-export" className="p-10 formal-ledger" style={{ fontFamily: "'Times New Roman', serif" }}>
           <style>
             {`
               .formal-ledger { color: #000; }
               .formal-h { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
               .formal-t { width: 100%; border-collapse: collapse; border: 1.5px solid #000; }
               .formal-t th { border: 1px solid #000; padding: 10px; background: #f0f0f0; font-weight: bold; }
               .formal-t td { border: 1px solid #000; padding: 8px; font-weight: bold; }
             `}
           </style>
           <div className="formal-h">
              {branch?.logo && <img src={branch.logo} style={{ width: '80px' }} />}
              <div style={{ textAlign: 'center', flex: 1 }}>
                <h1 style={{ fontSize: '24px', margin: 0 }}>{branch?.name}</h1>
                <p style={{ margin: '5px 0' }}>{branch?.address}</p>
                <p style={{ margin: '5px 0' }}>GSTIN: {branch?.gstin}</p>
              </div>
           </div>
           <h2 style={{ textAlign: 'center', textDecoration: 'underline' }}>CUSTOMER LEDGER STATEMENT</h2>
           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', border: '1px solid #000', padding: '15px' }}>
              <div>
                <strong>Account of:</strong><br/>
                {customer.name}<br/>
                {customer.address}
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong>Period:</strong> {formatDate(startDate)} TO {formatDate(endDate)}
              </div>
           </div>
           <table className="formal-t">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Particulars</th>
                  <th>Type</th>
                  <th>User</th>
                  <th>Delivery</th>
                  <th style={{ textAlign: 'right' }}>Debit</th>
                  <th style={{ textAlign: 'right' }}>Credit</th>
                  <th style={{ textAlign: 'right' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{formatDate(startDate)}</td>
                  <td>OPENING BALANCE B/F</td>
                  <td>-</td>
                  <td>-</td>
                  <td>-</td>
                  <td style={{ textAlign: 'right' }}>-</td>
                  <td style={{ textAlign: 'right' }}>-</td>
                  <td style={{ textAlign: 'right' }}>₹{Math.abs(openingBalance).toLocaleString()} {balanceLabel(openingBalance)}</td>
                </tr>
                {transactions.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontSize: '10px', whiteSpace: 'nowrap' }}>{formatDate(t.date, true)}</td>
                    <td>{t.particulars}</td>
                    <td>{t.type}</td>
                    <td>{t.user || "-"}</td>
                    <td>{t.deliveryMan || "-"}</td>
                    <td style={{ textAlign: 'right' }}>{t.debit > 0 ? t.debit.toLocaleString() : "-"}</td>
                    <td style={{ textAlign: 'right' }}>{t.credit > 0 ? t.credit.toLocaleString() : "-"}</td>
                    <td style={{ textAlign: 'right' }}>₹{Math.abs(t.balance).toLocaleString()} {balanceLabel(t.balance)}</td>
                  </tr>
                ))}
              </tbody>
           </table>
        </div>
      </div>
    </div>
  );
};

export default BranchCustomerLedger;
