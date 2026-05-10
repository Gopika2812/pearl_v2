import React, { useState, useEffect } from "react";
import { FaFileInvoice, FaDownload, FaSync, FaChartLine, FaCheckCircle, FaExclamationCircle } from "react-icons/fa";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";

const BranchGstReports = () => {
  const { branch } = useBranch();
  const [loading, setLoading] = useState(false);
  const [gstr1Data, setGstr1Data] = useState(null);
  const [gstr3bData, setGstr3bData] = useState(null);
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Quick Fix State
  const [fixingHsn, setFixingHsn] = useState(null);
  const [newHsnValue, setNewHsnValue] = useState("");
  const [isFixing, setIsFixing] = useState(false);

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const years = [2024, 2025, 2026];

  const fetchReports = () => {
    if (!branch?._id) return;
    
    // Independent loading: Clear old data but show structure
    setGstr1Data(null);
    setGstr3bData(null);
    setLoading(true);

    const query = `branchId=${branch._id}&month=${selectedMonth}&year=${selectedYear}`;

    // 🚀 Load GSTR-1 Independently
    fetchWithAuth(`${API_BASE}/gst-reports/gstr1?${query}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setGstr1Data(data.data);
        else toast.error("GSTR-1: " + (data.message || "Failed"));
      })
      .catch(() => toast.error("Error loading GSTR-1"));

    // 🚀 Load GSTR-3B Independently
    fetchWithAuth(`${API_BASE}/gst-reports/gstr3b?${query}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setGstr3bData(data.data);
        else toast.error("GSTR-3B: " + (data.message || "Failed"));
      })
      .catch(() => toast.error("Error loading GSTR-3B"))
      .finally(() => setLoading(false));
  };

  const handleBulkFixHsn = async () => {
    if (!newHsnValue || !fixingHsn) return;
    setIsFixing(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/gst-reports/bulk-fix-hsn`, {
        method: "POST",
        body: JSON.stringify({
          branchId: branch._id,
          productName: fixingHsn.description,
          oldHsn: fixingHsn.hsn,
          newHsn: newHsnValue,
          month: selectedMonth,
          year: selectedYear
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fix HSN");

      toast.success("✅ HSN Updated successfully");
      
      // ⚡ INSTANT UI UPDATE: Modify the local state instead of re-fetching everything
      if (gstr1Data && gstr1Data.hsnSummary) {
        setGstr1Data(prev => {
          const newSummary = [...prev.hsnSummary];
          const oldHsn = fixingHsn.hsn || fixingHsn._id;
          const targetIdx = newSummary.findIndex(h => (h.hsn || h._id) === oldHsn);
          
          if (targetIdx !== -1) {
            // Check if the NEW HSN already exists in the list (to merge them)
            const existingHsnIdx = newSummary.findIndex((h, idx) => idx !== targetIdx && (h.hsn || h._id) === newHsnValue);
            
            if (existingHsnIdx !== -1) {
              // MERGE: Add values to the existing row and remove the old one
              newSummary[existingHsnIdx].qty += newSummary[targetIdx].qty;
              newSummary[existingHsnIdx].taxableValue += newSummary[targetIdx].taxableValue;
              newSummary[existingHsnIdx].totalTax += newSummary[targetIdx].totalTax;
              newSummary.splice(targetIdx, 1);
            } else {
              // RENAME: Just update the HSN code in the current row
              newSummary[targetIdx].hsn = newHsnValue;
              if (newSummary[targetIdx]._id) newSummary[targetIdx]._id = newHsnValue;
            }
          }
          return { ...prev, hsnSummary: newSummary };
        });
      }

      setFixingHsn(null);
      setNewHsnValue("");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to update HSN");
    } finally {
      setIsFixing(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [branch?._id, selectedMonth, selectedYear]);

  const downloadGstr1Excel = () => {
    if (!gstr1Data) return;

    const wb = XLSX.utils.book_new();

    // Helper to add sheet with default empty row if no data
    const addSheet = (name, data, columns) => {
      const formatted = data.length > 0 ? data : [columns.reduce((acc, col) => ({ ...acc, [col]: "" }), {})];
      const sheet = XLSX.utils.json_to_sheet(formatted);
      XLSX.utils.book_append_sheet(wb, sheet, name);
    };

    // 1. B2B Sheet (b2b,sez,de)
    const b2bCols = ["GSTIN/UIN of Recipient", "Receiver Name", "Invoice Number", "Invoice date", "Invoice Value", "Place Of Supply", "Reverse Charge", "Applicable % of Tax Rate", "Invoice Type", "E-Commerce GSTIN", "Rate", "Taxable Value", "Cess Amount"];
    const b2bData = gstr1Data.b2b.map(row => ({
      "GSTIN/UIN of Recipient": row.gstin,
      "Receiver Name": row.customerName,
      "Invoice Number": row.invoiceNo,
      "Invoice date": row.date,
      "Invoice Value": row.value,
      "Place Of Supply": row.placeOfSupply,
      "Reverse Charge": row.reverseCharge,
      "Applicable % of Tax Rate": row.applicablePercent,
      "Invoice Type": row.invoiceType,
      "E-Commerce GSTIN": row.ecommerceGstin,
      "Rate": row.rate,
      "Taxable Value": row.taxableValue,
      "Cess Amount": row.cess
    }));
    addSheet("b2b,sez,de", b2bData, b2bCols);

    // 2. B2BA (Amendments)
    const b2baCols = ["GSTIN/UIN of Recipient", "Receiver Name", "Original Invoice Number", "Original Invoice date", "Revised Invoice Number", "Revised Invoice date", "Invoice Value", "Place Of Supply", "Reverse Charge", "Applicable % of Tax Rate", "Invoice Type", "E-Commerce GSTIN", "Rate", "Taxable Value", "Cess Amount"];
    addSheet("b2ba", [], b2baCols);

    // 3. B2CL (B2C Large)
    const b2clCols = ["Invoice Number", "Invoice date", "Invoice Value", "Place Of Supply", "Applicable % of Tax Rate", "Rate", "Taxable Value", "Cess Amount", "E-Commerce GSTIN"];
    const b2clData = (gstr1Data.b2cl || []).map(row => ({
      "Invoice Number": row.invoiceNo,
      "Invoice date": row.date,
      "Invoice Value": row.value,
      "Place Of Supply": row.placeOfSupply,
      "Applicable % of Tax Rate": row.applicablePercent,
      "Rate": row.rate,
      "Taxable Value": row.taxableValue,
      "Cess Amount": row.cess,
      "E-Commerce GSTIN": row.ecommerceGstin
    }));
    addSheet("b2cl", b2clData, b2clCols);

    // 4. B2CLA
    const b2claCols = ["Original Invoice Number", "Original Invoice date", "Original Place Of Supply", "Revised Invoice Number", "Revised Invoice date", "Invoice Value", "Applicable % of Tax Rate", "Rate", "Taxable Value", "Cess Amount", "E-Commerce GSTIN"];
    addSheet("b2cla", [], b2claCols);

    // 5. B2CS (B2C Small)
    const b2csCols = ["Type", "Place Of Supply", "Applicable % of Tax Rate", "Rate", "Taxable Value", "Cess Amount", "E-Commerce GSTIN"];
    const b2csData = (gstr1Data.b2cs || []).map(row => ({
      "Type": row.type,
      "Place Of Supply": row.placeOfSupply,
      "Applicable % of Tax Rate": "",
      "Rate": row.rate,
      "Taxable Value": row.taxableValue,
      "Cess Amount": row.cess,
      "E-Commerce GSTIN": row.ecommerceGstin || ""
    }));
    addSheet("b2cs", b2csData, b2csCols);

    // 6. B2CSA
    const b2csaCols = ["Financial Year", "Original Month", "Place Of Supply", "Type", "Applicable % of Tax Rate", "Rate", "Taxable Value", "Cess Amount", "E-Commerce GSTIN"];
    addSheet("b2csa", [], b2csaCols);

    // 7. CDNR (Credit/Debit Notes Registered)
    const cdnrCols = ["GSTIN/UIN of Recipient", "Receiver Name", "Note Number", "Note Date", "Note Type", "Place Of Supply", "Reverse Charge", "Note Supply Type", "Note Value", "Applicable % of Tax Rate", "Rate", "Taxable Value", "Cess Amount"];
    const cdnrData = (gstr1Data.cdnr || []).map(row => ({
      "GSTIN/UIN of Recipient": row.gstin,
      "Receiver Name": row.customerName,
      "Note Number": row.noteNo,
      "Note Date": row.noteDate,
      "Note Type": row.noteType,
      "Place Of Supply": row.placeOfSupply,
      "Reverse Charge": row.reverseCharge,
      "Note Supply Type": row.noteSupplyType,
      "Note Value": row.noteValue,
      "Applicable % of Tax Rate": row.applicablePercent,
      "Rate": row.rate,
      "Taxable Value": row.taxableValue,
      "Cess Amount": row.cess
    }));
    addSheet("cdnr", cdnrData, cdnrCols);

    // 8. CDNRA / CDNUR / CDNURA
    const cdnraCols = ["GSTIN/UIN of Recipient", "Receiver Name", "Original Note Number", "Original Note Date", "Revised Note Number", "Revised Note Date", "Note Type", "Place Of Supply", "Reverse Charge", "Note Supply Type", "Note Value", "Applicable % of Tax Rate", "Rate", "Taxable Value", "Cess Amount"];
    addSheet("cdnra", [], cdnraCols);

    const cdnurCols = ["UR Type", "Note Number", "Note Date", "Note Type", "Place Of Supply", "Note Value", "Applicable % of Tax Rate", "Rate", "Taxable Value", "Cess Amount"];
    const cdnurData = (gstr1Data.cdnur || []).map(row => ({
      "UR Type": row.type,
      "Note Number": row.noteNo,
      "Note Date": row.noteDate,
      "Note Type": row.noteType,
      "Place Of Supply": row.placeOfSupply,
      "Note Value": row.noteValue,
      "Applicable % of Tax Rate": row.applicablePercent,
      "Rate": row.rate,
      "Taxable Value": row.taxableValue,
      "Cess Amount": row.cess
    }));
    addSheet("cdnur", cdnurData, cdnurCols);

    const cdnuraCols = ["UR Type", "Original Note Number", "Original Note Date", "Revised Note Number", "Revised Note Date", "Note Type", "Place Of Supply", "Note Value", "Applicable % of Tax Rate", "Rate", "Taxable Value", "Cess Amount"];
    addSheet("cdnura", [], cdnuraCols);

    // 9. Exports / Advance Tax
    addSheet("exp", [], ["Export Type", "Invoice Number", "Invoice date", "Invoice Value", "Port Code", "Shipping Bill Number", "Shipping Bill Date", "Rate", "Taxable Value", "Cess Amount"]);
    addSheet("expa", [], ["Export Type", "Original Invoice Number", "Original Invoice date", "Revised Invoice Number", "Revised Invoice date", "Invoice Value", "Port Code", "Shipping Bill Number", "Shipping Bill Date", "Rate", "Taxable Value", "Cess Amount"]);
    addSheet("at", [], ["Place Of Supply", "Applicable % of Tax Rate", "Rate", "Gross Advance Received", "Cess Amount"]);
    addSheet("ata", [], ["Financial Year", "Original Month", "Place Of Supply", "Applicable % of Tax Rate", "Rate", "Gross Advance Received", "Cess Amount"]);
    addSheet("atadj", [], ["Place Of Supply", "Applicable % of Tax Rate", "Rate", "Gross Advance Adjusted", "Cess Amount"]);
    addSheet("atadja", [], ["Financial Year", "Original Month", "Place Of Supply", "Applicable % of Tax Rate", "Rate", "Gross Advance Adjusted", "Cess Amount"]);

    // 10. EXEMP (Exempted)
    const exempCols = ["Description", "Nil Rated", "Exempted", "Non GST supplies"];
    const exempData = (gstr1Data.nilRated || []).map(row => ({
      "Description": row.description,
      "Nil Rated": row.nilRated,
      "Exempted": row.exempt,
      "Non GST supplies": row.nonGst
    }));
    addSheet("exemp", exempData, exempCols);

    // 11. HSN Sheets
    const hsnCols = ["HSN", "Description", "UQC", "Total Quantity", "Total Value", "Rate", "Taxable Value", "Integrated Tax Amount", "Central Tax Amount", "State/UT Tax Amount", "Cess Amount"];
    const hsnB2B = (gstr1Data.hsnSummaryB2B || []).map(row => ({
      "HSN": row.hsn, "Description": row.description, "UQC": row.uqc, "Total Quantity": row.totalQty, "Total Value": row.totalValue, "Rate": row.rate, "Taxable Value": row.taxableValue,
      "Integrated Tax Amount": row.igst, "Central Tax Amount": row.cgst, "State/UT Tax Amount": row.sgst, "Cess Amount": row.cess
    }));
    addSheet("hsn(b2b)", hsnB2B, hsnCols);

    const hsnB2C = (gstr1Data.hsnSummaryB2C || []).map(row => ({
      "HSN": row.hsn, "Description": row.description, "UQC": row.uqc, "Total Quantity": row.totalQty, "Total Value": row.totalValue, "Rate": row.rate, "Taxable Value": row.taxableValue,
      "Integrated Tax Amount": row.igst, "Central Tax Amount": row.cgst, "State/UT Tax Amount": row.sgst, "Cess Amount": row.cess
    }));
    addSheet("hsn(b2c)", hsnB2C, hsnCols);

    // 12. DOCS Sheet
    const docCols = ["Nature of Document", "Sr. No. From", "Sr. No. To", "Total Number", "Cancelled"];
    const docData = (gstr1Data.docSummary || []).map(row => ({
      "Nature of Document": row.nature, "Sr. No. From": row.from, "Sr. No. To": row.to, "Total Number": row.total, "Cancelled": row.cancelled
    }));
    // Add the "Inward Supply" row even if empty to match screenshot
    if (!docData.find(d => d["Nature of Document"].includes("inward supply"))) {
      docData.push({ "Nature of Document": "Invoices for inward supply from unregistered person", "Sr. No. From": "", "Sr. No. To": "", "Total Number": 0, "Cancelled": 0 });
    }
    addSheet("docs", docData, docCols);

    XLSX.writeFile(wb, `GSTR1_${branch?.name}_${months[selectedMonth - 1]}_${selectedYear}.xlsx`);
  };

  const SummaryCard = ({ title, value, color, icon: Icon }) => (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between">
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <p className={`text-2xl font-black ${color}`}>₹{value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
      </div>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${color.replace('text', 'bg')}/10`}>
        <Icon className={`text-xl ${color}`} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      {/* Premium Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
             <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                <FaFileInvoice size={20} />
             </div>
             <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">GST Filing Center</h1>
          </div>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-widest ml-14">Monthly Compliance & Reporting</p>
        </div>

        <div className="flex items-center gap-4 bg-slate-100 p-2 rounded-2xl">
          <select 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="bg-white border-none rounded-xl px-4 py-2 text-xs font-black text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer"
          >
            {months.map((m, idx) => (
              <option key={m} value={idx + 1}>{m}</option>
            ))}
          </select>
          <select 
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="bg-white border-none rounded-xl px-4 py-2 text-xs font-black text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer"
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button 
            onClick={async () => {
              if (window.confirm("This will scan all invoices and pull those that 'jumped' months back to their original SO dates. Continue?")) {
                setLoading(true);
                try {
                  const res = await fetchWithAuth(`${API_BASE}/gst-reports/super-repair`, {
                    method: "POST",
                    body: JSON.stringify({ 
                      branchId: branch._id,
                      month: selectedMonth,
                      year: selectedYear
                    })
                  });
                  const data = await res.json();
                  if (data.success) {
                    toast.success(data.message);
                    fetchReports(); // Refresh data
                  } else {
                    toast.error(data.message);
                  }
                } catch (err) {
                  toast.error("Failed to repair dates");
                } finally {
                  setLoading(false);
                }
              }
            }}
            className="flex items-center gap-2 bg-rose-50 text-rose-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition border border-rose-100"
            title="Fix invoices that jumped from April to May"
          >
            🔧 Repair Month-Jump Errors
          </button>
          <button 
            onClick={fetchReports}
            className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
          >
            <FaSync className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 mt-10">
        
        {/* GSTR-3B Summary Row */}
        <div className="mb-10">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
             <FaChartLine /> Filing Overview (Count Check)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Invoices</p>
              <p className="text-2xl font-black text-slate-900">{gstr1Data?.rawCounts?.total || 0}</p>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">B2B / B2C</p>
              <div className="flex items-center gap-2">
                <p className="text-xl font-black text-emerald-600">{gstr1Data?.rawCounts?.b2b || 0}</p>
                <span className="text-slate-300">/</span>
                <p className="text-xl font-black text-indigo-600">{gstr1Data?.rawCounts?.b2c || 0}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cancelled Invoices</p>
              <p className="text-2xl font-black text-rose-600">{gstr1Data?.rawCounts?.cancelled || 0}</p>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-rose-100 bg-rose-50/30">
              <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Invalid HSN</p>
              <p className="text-2xl font-black text-rose-600">
                {gstr1Data?.hsnSummary?.filter(h => ![4, 6, 8].includes(h.hsn.toString().length)).length || 0}
              </p>
            </div>
          </div>
        </div>

        {/* GSTR-3B Financials */}
        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
           <FaChartLine /> Tax Liability Summary
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <SummaryCard 
            title="Total Sales (Outward)" 
            value={gstr3bData?.outwardSupplies?.taxable || 0} 
            color="text-emerald-600"
            icon={FaCheckCircle}
          />
          <SummaryCard 
            title="Eligible ITC (Purchases)" 
            value={gstr3bData?.eligibleITC?.taxable || 0} 
            color="text-indigo-600"
            icon={FaDownload}
          />
          <SummaryCard 
            title="Net Tax Liability" 
            value={(gstr3bData?.outwardSupplies?.igst || 0) + (gstr3bData?.outwardSupplies?.cgst || 0) + (gstr3bData?.outwardSupplies?.sgst || 0) - ((gstr3bData?.eligibleITC?.igst || 0) + (gstr3bData?.eligibleITC?.cgst || 0) + (gstr3bData?.eligibleITC?.sgst || 0))} 
            color="text-rose-600"
            icon={FaExclamationCircle}
          />
        </div>

        {/* GSTR-1 Section */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
             <FaFileInvoice /> GSTR-1 Breakdown (Sales)
          </h2>
          <div className="flex gap-4">
            <button 
              onClick={downloadGstr1Excel}
              disabled={gstr1Data?.hsnSummary?.some(h => ![4, 6, 8].includes(h.hsn.toString().length))}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition shadow-lg ${
                gstr1Data?.hsnSummary?.some(h => ![4, 6, 8].includes(h.hsn.toString().length))
                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100"
              }`}
            >
              <FaDownload /> Download Tally Excel
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* B2B Table */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">B2B Invoices</span>
              <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[9px] font-black">{gstr1Data?.b2b?.length || 0} Records</span>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-white sticky top-0">
                  <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <th className="px-6 py-4">GSTIN</th>
                    <th className="px-6 py-4">Invoice</th>
                    <th className="px-6 py-4">Taxable</th>
                    <th className="px-6 py-4 text-right">Tax</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {gstr1Data?.b2b?.map((row, idx) => (
                    <tr key={idx} className={`hover:bg-slate-50 transition-all ${row.status === 'CANCELLED' ? 'opacity-50' : ''}`}>
                      <td className="px-6 py-4 text-[10px] font-bold text-slate-600 uppercase">
                        {row.gstin}
                        {row.status === 'CANCELLED' && <span className="ml-2 bg-rose-100 text-rose-600 px-2 py-0.5 rounded text-[8px] font-black">CANCELLED</span>}
                      </td>
                      <td className="px-6 py-4 text-[10px] font-black text-indigo-600">{row.invoiceNo}</td>
                      <td className="px-6 py-4 text-[10px] font-bold text-slate-700">₹{row.taxableValue.toFixed(2)}</td>
                      <td className="px-6 py-4 text-[10px] font-black text-slate-900 text-right">₹{(row.igst + row.cgst + row.sgst).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* HSN Summary Table */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">HSN Summary</span>
              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[9px] font-black">{gstr1Data?.hsnSummary?.length || 0} Categories</span>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-white sticky top-0">
                  <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <th className="px-6 py-4">HSN</th>
                    <th className="px-6 py-4">Description</th>
                    <th className="px-6 py-4">Qty</th>
                    <th className="px-6 py-4 text-right">Taxable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {gstr1Data?.hsnSummary?.map((row, idx) => {
                    const isInvalid = ![4, 6, 8].includes(row.hsn.toString().length);
                    return (
                      <tr 
                        key={idx} 
                        onClick={() => {
                          setFixingHsn(row);
                          setNewHsnValue(row.hsn);
                        }}
                        className={`transition-all cursor-pointer ${isInvalid ? 'bg-rose-50 hover:bg-rose-100' : 'hover:bg-slate-50'}`}
                        title="Click to Bulk Fix HSN for all invoices"
                      >
                        <td className={`px-6 py-4 text-[10px] font-black tracking-tighter ${isInvalid ? 'text-rose-600' : 'text-slate-800'}`}>
                          {row.hsn}
                          {isInvalid && <span className="ml-2 text-[8px] bg-rose-600 text-white px-1 rounded">INVALID LENGTH</span>}
                        </td>
                        <td className="px-6 py-4 text-[9px] font-bold text-slate-500 uppercase truncate max-w-[150px]">{row.description}</td>
                        <td className="px-6 py-4 text-[10px] font-bold text-slate-600">{row.totalQty} {row.uqc}</td>
                        <td className="px-6 py-4 text-[10px] font-black text-slate-900 text-right">₹{row.taxableValue.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Info Box */}
        <div className="mt-12 bg-indigo-50 border border-indigo-100 rounded-[2rem] p-8 flex items-start gap-6">
           <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
              <FaCheckCircle size={24} />
           </div>
           <div>
              <h3 className="text-sm font-black text-indigo-900 uppercase tracking-widest mb-1">Filing Instructions</h3>
              <p className="text-[11px] text-indigo-700/80 font-bold leading-relaxed max-w-2xl uppercase tracking-tighter">
                Download the GSTR-1 Excel for Tally import or direct submission via the GST Offline Tool. 
                Ensure all invoices shown above have a 'Ready' status. 
                Purchases for GSTR-3B ITC are pulled directly from your finalized Purchase Invoices.
              </p>
           </div>
        </div>

      </div>

      {/* Quick Fix Modal */}
      {fixingHsn && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="bg-indigo-600 p-8 text-white relative">
               <h3 className="text-2xl font-black uppercase tracking-tighter">Bulk HSN Repair</h3>
               <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">Updating Product Master & Invoices</p>
            </div>
            <div className="p-8">
               <div className="mb-6">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Product Name</p>
                  <p className="text-sm font-bold text-slate-800 uppercase bg-slate-50 p-4 rounded-2xl border border-slate-100 italic">
                    "{fixingHsn.description}"
                  </p>
               </div>

               <div className="grid grid-cols-2 gap-4 mb-8">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Current HSN</p>
                    <p className="text-lg font-black text-rose-500 bg-rose-50 px-4 py-3 rounded-2xl border border-rose-100">{fixingHsn.hsn}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">New HSN</p>
                    <input 
                      type="text"
                      value={newHsnValue}
                      onChange={(e) => setNewHsnValue(e.target.value)}
                      placeholder="Enter 4, 6 or 8 digits"
                      className="w-full text-lg font-black text-indigo-600 bg-indigo-50 px-4 py-3 rounded-2xl border border-indigo-100 outline-none focus:ring-2 focus:ring-indigo-500"
                      autoFocus
                    />
                  </div>
               </div>

               <div className="flex gap-3">
                  <button 
                    onClick={() => setFixingHsn(null)}
                    className="flex-1 px-6 py-4 bg-slate-100 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleBulkFixHsn}
                    disabled={isFixing || !newHsnValue || newHsnValue === fixingHsn.hsn}
                    className="flex-[2] px-6 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 disabled:opacity-50"
                  >
                    {isFixing ? "Repairing..." : "Repair All Invoices"}
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default BranchGstReports;
