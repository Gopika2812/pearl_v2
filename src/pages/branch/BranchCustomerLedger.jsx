import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useEffect, useState } from "react";
import {
  FaArrowLeft,
  FaCalendarAlt,
  FaDownload,
  FaExchangeAlt,
  FaTruck,
  FaUser
} from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import * as XLSX from 'xlsx';
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";

const BranchCustomerLedger = () => {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const { currentBranch: branch, user } = useBranch();

  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState(null);
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
        if (data.linkedVendorId) {
          toast.info("Consolidated Ledger Active: Includes Purchase History");
        }
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



  const handleNavigateToOrder = (txn) => {
    if (!txn.salesOrderId) return;

    // Extract invoice number from particulars if possible
    let invNo = "";

    // 1. Check for "for Invoice(s): SI-123" (common in receipts)
    const forInvMatch = txn.particulars?.match(/for Invoice?s?:\s*([^,\[(\n]+)/i);
    if (forInvMatch) {
      invNo = forInvMatch[1].trim();
    }
    // 2. Check for "for Inv: SI-123" (shorthand)
    else {
      const shorthandMatch = txn.particulars?.match(/for Inv:\s*([^,\[(\n]+)/i);
      if (shorthandMatch) {
        invNo = shorthandMatch[1].trim();
      }
      // 3. Check for "Sales Invoice: SI-123" (direct invoice entry)
      else if (txn.type === "INVOICE") {
        invNo = txn.particulars.split(": ")[1]?.trim() || "";
      }
      // 4. Check for "Credit Note: CN-123" or similar
      else {
        const genericMatch = txn.particulars?.match(/(?:Invoice|Note|Ref):\s*([^,\[(\n]+)/i);
        if (genericMatch) invNo = genericMatch[1].trim();
      }
    }

    if (!invNo) return;
    // This will trigger the global search for that specific ID across all dates
    navigate(`/branch/sales-orders?invoiceId=${encodeURIComponent(invNo)}`);
  };

  const handleTransferTransaction = async (txn) => {
    const targetName = prompt("Enter full name of target customer to search:");
    if (!targetName) return;

    try {
      toast.loading("Searching for customer...", { id: "search-cust" });
      const searchRes = await fetchWithAuth(`${API_BASE}/customers?branchId=${branch._id}&search=${encodeURIComponent(targetName)}&limit=5`);
      const searchData = await searchRes.json();
      toast.dismiss("search-cust");

      if (!searchData.data || searchData.data.length === 0) {
        return toast.error("No customer found with that name.");
      }

      const target = searchData.data[0];
      if (!window.confirm(`Are you sure you want to TRANSFER this transaction to "${target.name}"? This will shift the balance and update all records.`)) return;

      toast.loading("Transferring transaction...", { id: "transfer-txn" });
      const res = await fetchWithAuth(`${API_BASE}/customers/transfer-transaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: txn.type,
          transactionId: txn.id,
          targetCustomerId: target._id
        })
      });

      const result = await res.json();
      if (result.success) {
        toast.success("Transaction transferred successfully!", { id: "transfer-txn" });
        fetchLedger();
      } else {
        toast.error(result.message || "Transfer failed", { id: "transfer-txn" });
      }
    } catch (err) {
      console.error("Transfer error:", err);
      toast.error("An error occurred during transfer", { id: "transfer-txn" });
    }
  };

  const handleExportPDF = async () => {
    const element = document.getElementById("formal-ledger-export");
    if (!element) return toast.error("Export template not found");

    toast.loading("Generating A5 Ledger PDF...", { id: "pdf-gen" });

    try {
      // Increase width for higher quality, but maintain aspect ratio
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        scrollY: -window.scrollY,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a5");

      const pdfWidth = pdf.internal.pageSize.getWidth(); // 148mm
      const pdfHeight = pdf.internal.pageSize.getHeight(); // 210mm

      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;
      let pageNumber = 1;

      // First Page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pdfHeight;

      // Subsequent Pages
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pdfHeight;
        pageNumber++;
      }

      pdf.save(`Ledger-${customer?.name}-${startDate}-to-${endDate}.pdf`);
      toast.success(`A5 PDF Downloaded (${pageNumber} Pages)!`, { id: "pdf-gen" });
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
      transactions.filter(txn => !String(txn.type).toUpperCase().includes("CANCEL")).forEach(txn => {
        let docId = "-";
        const invMatch = txn.particulars?.match(/for Inv:\s*([^\s(]+)/i);
        const pm = txn.particulars?.match(/(?:Invoice|Receipt|Note|CHEQUE BOUNCE):\s*([^\s(]+)/i);

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

  const totalDebit = transactions.filter(t => !String(t.type).toUpperCase().includes("CANCEL")).reduce((sum, t) => sum + t.debit, 0);
  const totalCredit = transactions.filter(t => !String(t.type).toUpperCase().includes("CANCEL")).reduce((sum, t) => sum + t.credit, 0);

  if (!customer) return null;

  return (
    <div className="space-y-6">      {customer?.linkedVendorId && (
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 p-6 rounded-3xl shadow-sm flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 text-white p-3 rounded-2xl shadow-lg">
              <FaExchangeAlt />
            </div>
            <div>
              <h1 className="text-lg font-black text-indigo-900 uppercase tracking-tight">Consolidated Ledger Active</h1>
              <p className="text-indigo-600 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                Linked Vendor: <span className="text-indigo-800">{customer.linkedVendorId?.name}</span> • Showing both Sales & Purchases
              </p>
            </div>
          </div>
        </div>
      )}


      {customer?.linkedVendorId ? null : (
        <>
      {/* PREMIUM HEADER */}
      {!customer?.linkedVendorId && (
        <div className="relative overflow-hidden bg-white/50 backdrop-blur-md p-8 rounded-3xl border border-white/50 shadow-sm">
          {/* Existing header content */}
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
      )}
        </>
      )}

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
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Opening Balance</p>
          </div>
          <p className={`text-2xl font-black tracking-tight leading-none ${balanceColor(openingBalance)}`}>
            ₹{Math.abs(openingBalance).toLocaleString()} <span className="text-xs uppercase opacity-60 underline decoration-slate-200">{balanceLabel(openingBalance)}</span>
          </p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Closing Balance</p>
          </div>
          <p className={`text-2xl font-black tracking-tight leading-none ${balanceColor(closingBalance)}`}>
            ₹{Math.abs(closingBalance).toLocaleString()} <span className="text-xs uppercase opacity-60 underline decoration-slate-200">{balanceLabel(closingBalance)}</span>
          </p>
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
                  <th className="px-6 py-6 text-left"><div className="flex items-center gap-2"><FaUser size={10} className="text-indigo-400" /> User</div></th>
                  <th className="px-6 py-6 text-left"><div className="flex items-center gap-2"><FaTruck size={10} className="text-indigo-400" /> Delivery</div></th>
                  <th className="px-6 py-6 text-right">Debit (Dr)</th>
                  <th className="px-6 py-6 text-right">Credit (Cr)</th>
                  <th className="px-6 py-6 text-center">Balance</th>
                  <th className="px-8 py-6 text-right rounded-tr-[2rem]">Tools</th>
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
                  const invMatch = txn.particulars?.match(/for Invoice?s?:\s*([^\[(]+)/i);
                  const pm = txn.particulars?.match(/(?:Invoice|Receipt|Note|Journal|CHEQUE BOUNCE):\s*([^\[( \n]+)/i);

                  if (invMatch) docId = invMatch[1].trim();
                  else if (pm) docId = pm[1].trim();
                  else if (txn.type === "INVOICE") docId = txn.particulars.split(": ")[1] || "-";

                  return (
                    <tr key={txn.id} className="hover:bg-slate-50/80 transition-all duration-300 group cursor-default">
                      <td className="px-8 py-6 text-slate-300 group-hover:text-indigo-400 transition-colors">{index + 1}</td>
                      <td className="px-6 py-6 text-slate-500 whitespace-nowrap">{formatDate(txn.date, true)}</td>
                      <td className="px-6 py-6">
                        <button
                          onClick={() => handleNavigateToOrder(txn)}
                          disabled={!txn.salesOrderId}
                          className={`text-left group/btn ${txn.salesOrderId ? 'cursor-pointer' : 'cursor-default'}`}
                        >
                          <div className={`text-slate-800 group-hover/btn:text-indigo-600 transition-colors uppercase tracking-tight font-black ${txn.type === 'CANCELLED' ? 'line-through text-slate-400' : ''}`} title={docId}>
                            {docId}
                            {txn.branchName && txn.branchName !== branch?.name && (
                              <span className="ml-2 text-[8px] bg-orange-100 text-orange-600 px-1 py-0.5 rounded uppercase font-black tracking-tighter" title={`Origin: ${txn.branchName}`}>
                                📍 {txn.branchCode}
                              </span>
                            )}
                            {txn.salesOrderId && <span className="ml-1 opacity-0 group-hover/btn:opacity-100 text-[8px] font-black bg-indigo-50 text-indigo-600 px-1 py-0.5 rounded transition-all">VIEW BILL</span>}
                          </div>
                        </button>
                        <div className={`text-[10px] text-slate-900 font-black italic line-clamp-2 mt-1 max-w-[250px] leading-tight ${txn.type === 'CANCELLED' ? 'line-through text-slate-400' : ''}`} title={txn.particulars}>
                          {txn.particulars}
                        </div>
                      </td>
                      <td className="px-6 py-6 text-center">
                        <span className={`px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider shadow-sm border ${
                          txn.type === "INVOICE" ? "bg-rose-50 text-rose-600 border-rose-100" :
                          txn.type === "RECEIPT" || txn.type === "BOUNCED" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                          txn.type === "PURCHASE" ? "bg-amber-50 text-amber-600 border-amber-100" :
                          txn.type === "VENDOR_PAYMENT" ? "bg-blue-50 text-blue-600 border-blue-100" :
                          txn.type === "CANCELLED" ? "bg-slate-100 text-slate-400 border-slate-200" :
                          txn.type.includes("JOURNAL") ? "bg-purple-50 text-purple-600 border-purple-100" :
                          "bg-indigo-50 text-indigo-600 border-indigo-100"
                        }`}>
                          {txn.type === "RECEIPT" ? (txn.particulars?.match(/\(([^)]+)\)/)?.[1]?.toUpperCase() || "CASH") : 
                           txn.type === "PURCHASE" ? "PURCHASE" :
                           txn.type === "VENDOR_PAYMENT" ? "V-PAYMENT" :
                           txn.type === "JOURNAL_DR" ? "JOURNAL-DR" :
                           txn.type === "JOURNAL_CR" ? "JOURNAL-CR" : txn.type}
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
                      <td className={`px-6 py-6 text-right font-black text-[14px] ${balanceColor(txn.balance)}`}>
                        ₹{Math.abs(txn.balance).toLocaleString()} <span className="text-[10px] opacity-40">{balanceLabel(txn.balance)}</span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        {user?.role === "SUPER_ADMIN" && (
                          <button
                            onClick={() => handleTransferTransaction(txn)}
                            className="text-slate-300 hover:text-indigo-600 transition p-2"
                            title="Transfer Transaction to another Customer"
                          >
                            <FaExchangeAlt size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {/* Period Totals */}
                <tr className="bg-slate-900 text-white shadow-2xl">
                  <td colSpan={6} className="px-6 py-8 text-right uppercase tracking-[0.3em] text-[10px] opacity-50">Period Totals</td>
                  <td className="px-6 py-8 text-right font-black text-rose-300 text-base">₹{totalDebit.toLocaleString()}</td>
                  <td className="px-6 py-8 text-right font-black text-emerald-300 text-base">₹{totalCredit.toLocaleString()}</td>
                  <td className="px-6 py-8 text-right font-black bg-white/10 text-lg">₹{Math.abs(closingBalance).toLocaleString()} <span className="text-xs opacity-50">{balanceLabel(closingBalance)}</span></td>
                  <td className="px-8 py-8 bg-white/10"></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* OFF-SCREEN EXPORT TEMPLATE */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '800px', background: 'white' }}>
        <div id="formal-ledger-export" className="p-10 formal-ledger" style={{ fontFamily: "'Times New Roman', serif" }}>
          <style>
            {`
               .formal-ledger { color: #000; padding: 30px 30px 60px 30px; }
               .formal-h { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; align-items: center; }
               .formal-t { width: 100%; border-collapse: collapse; border: 1.5px solid #000; }
               .formal-t th { border: 1px solid #000; padding: 6px 4px; background: #f5f5f5; font-size: 11px; font-weight: bold; text-transform: uppercase; }
               .formal-t td { border: 1px solid #000; padding: 5px 4px; font-weight: bold; font-size: 10px; }
               .formal-footer { margin-top: 15px; border: 1px solid #000; padding: 10px; display: flex; justify-content: space-between; align-items: center; background: #f9f9f9; margin-bottom: 20px; }
             `}
          </style>
          <div className="formal-h">
            {branch?.logo && <img src={branch.logo} style={{ width: '60px', height: 'auto' }} />}
            <div style={{ textAlign: 'center', flex: 1 }}>
              <h1 style={{ fontSize: '20px', margin: 0, fontWeight: 'bold' }}>{branch?.name}</h1>
              <p style={{ margin: '3px 0', fontSize: '11px' }}>{branch?.address}</p>
              <p style={{ margin: '3px 0', fontSize: '11px', fontWeight: 'bold' }}>GSTIN: {branch?.gstin}</p>
            </div>
          </div>
          <h2 style={{ textAlign: 'center', textDecoration: 'underline', fontSize: '16px', margin: '15px 0', fontWeight: 'bold' }}>CUSTOMER LEDGER STATEMENT</h2>
          <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', marginBottom: '15px', border: '1px solid #000', padding: '10px', fontSize: '12px' }}>
            <div style={{ flex: 1 }}>
              <strong>Account of:</strong><br />
              <span style={{ fontSize: '14px' }}>{customer.name}</span><br />
              <p style={{ margin: '2px 0', maxWidth: '300px' }}>{customer.address}</p>
              <p style={{ margin: '2px 0' }}>{customer.gstin ? `GSTIN: ${customer.gstin}` : ""}</p>
            </div>
            <div style={{ textAlign: 'right', flex: 1 }}>
              <p style={{ margin: '2px 0' }}><strong>Period:</strong> {formatDate(startDate)} TO {formatDate(endDate)}</p>
              <p style={{ margin: '2px 0' }}><strong>Report Date:</strong> {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            </div>
          </div>
          <table className="formal-t">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>Date</th>
                <th>Particulars / Reference</th>
                <th style={{ width: '50px' }}>Type</th>
                <th style={{ width: '60px' }}>User</th>
                <th style={{ width: '80px' }}>Delivery</th>
                <th style={{ textAlign: 'right', width: '70px' }}>Debit</th>
                <th style={{ textAlign: 'right', width: '70px' }}>Credit</th>
                <th style={{ textAlign: 'right', width: '90px' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ background: '#f9f9f9' }}>
                <td>{formatDate(startDate)}</td>
                <td style={{ letterSpacing: '0.05em' }}>OPENING BALANCE B/F</td>
                <td style={{ textAlign: 'center' }}>-</td>
                <td style={{ textAlign: 'center' }}>-</td>
                <td style={{ textAlign: 'center' }}>-</td>
                <td style={{ textAlign: 'right' }}>-</td>
                <td style={{ textAlign: 'right' }}>-</td>
                <td style={{ textAlign: 'right', fontSize: '11px' }}>₹{Math.abs(openingBalance).toLocaleString()} {balanceLabel(openingBalance)}</td>
              </tr>
              {transactions.filter(t => !String(t.type).toUpperCase().includes("CANCEL")).map(t => (
                <tr key={t.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDate(t.date, true)}</td>
                  <td style={{ maxWidth: '220px', wordWrap: 'break-word' }}>{t.particulars}</td>
                  <td style={{ textAlign: 'center' }}>{t.type}</td>
                  <td style={{ textAlign: 'center' }}>{t.user || "-"}</td>
                  <td style={{ textAlign: 'center' }}>{t.deliveryMan || "-"}</td>
                  <td style={{ textAlign: 'right', color: t.debit > 0 ? '#b91c1c' : '#000' }}>{t.debit > 0 ? t.debit.toLocaleString() : "-"}</td>
                  <td style={{ textAlign: 'right', color: t.credit > 0 ? '#047857' : '#000' }}>{t.credit > 0 ? t.credit.toLocaleString() : "-"}</td>
                  <td style={{ textAlign: 'right', fontSize: '11px' }}>₹{Math.abs(t.balance).toLocaleString()} {balanceLabel(t.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="formal-footer">
            <div style={{ fontSize: '11px' }}>
              <p style={{ margin: '2px 0' }}><strong>Total Debit:</strong> ₹{totalDebit.toLocaleString()}</p>
              <p style={{ margin: '2px 0' }}><strong>Total Credit:</strong> ₹{totalCredit.toLocaleString()}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '14px', fontWeight: 'bold', margin: 0 }}>Closing Balance: ₹{Math.abs(closingBalance).toLocaleString()} {balanceLabel(closingBalance)}</p>
              <p style={{ fontSize: '10px', marginTop: '5px', color: '#666' }}>* This is a computer generated statement.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BranchCustomerLedger;
