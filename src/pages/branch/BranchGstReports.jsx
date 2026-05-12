import React, { useState, useEffect } from "react";
import { FaFileInvoice, FaDownload, FaSync, FaChartLine, FaCheckCircle, FaExclamationCircle, FaExclamationTriangle, FaTimes } from "react-icons/fa";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
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
  const [filterRate, setFilterRate] = useState(null);

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
        if (data.success) {
          const reportData = data.data;
          // Merge HSN summaries for UI visibility and validation
          const mergedHsn = {};
          [...(reportData.hsnSummaryB2B || []), ...(reportData.hsnSummaryB2C || [])].forEach(row => {
            const key = `${row.hsn}_${row.rate}`;
            if (!mergedHsn[key]) {
              mergedHsn[key] = { ...row, invoiceNumbers: [...(row.invoiceNumbers || [])] };
            } else {
              mergedHsn[key].totalQty += row.totalQty;
              mergedHsn[key].totalValue += row.totalValue;
              mergedHsn[key].taxableValue += row.taxableValue;
              mergedHsn[key].igst += row.igst || 0;
              mergedHsn[key].cgst += row.cgst || 0;
              mergedHsn[key].sgst += row.sgst || 0;
              mergedHsn[key].cess += row.cess || 0;
              // Unique invoices
              const existingInvoices = new Set(mergedHsn[key].invoiceNumbers);
              (row.invoiceNumbers || []).forEach(num => existingInvoices.add(num));
              mergedHsn[key].invoiceNumbers = Array.from(existingInvoices);
            }
          });
          reportData.hsnSummary = Object.values(mergedHsn);
          setGstr1Data(reportData);
        } else {
          toast.error("GSTR-1: " + (data.message || "Failed"));
        }
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

  const downloadB2BExcel_Standalone = () => {
    if (!gstr1Data || !gstr1Data.b2b) return;
    const fileName = `${branch?.gstin || "NO_GSTIN"}_B2B_RECORDS_${months[selectedMonth - 1]}_${selectedYear}`;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("B2B_Records");
    
    const columns = ["GSTIN/UIN of Recipient", "Receiver Name", "Invoice Number", "Invoice date", "Invoice Value", "Place Of Supply", "Reverse Charge", "Applicable % of Tax Rate", "Invoice Type", "E-Commerce GSTIN", "Rate", "Taxable Value", "Cess Amount"];
    
    const headerRow = sheet.addRow(columns);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    });

    gstr1Data.b2b.forEach(row => {
      sheet.addRow([
        row.gstin, row.customerName, row.invoiceNo, row.date, row.value, row.placeOfSupply, row.reverseCharge, row.applicablePercent, row.invoiceType, row.ecommerceGstin, row.rate, row.taxableValue, row.cess
      ]);
    });

    // Auto-width
    sheet.columns.forEach((column) => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) maxLength = columnLength;
      });
      column.width = maxLength < 12 ? 12 : maxLength + 2;
    });

    workbook.xlsx.writeBuffer().then((buffer) => {
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    });
  };

  const downloadB2CExcel_Standalone = () => {
    if (!gstr1Data || !gstr1Data.b2cRaw) return;
    const fileName = `${branch?.gstin || "NO_GSTIN"}_B2C_RECORDS_${months[selectedMonth - 1]}_${selectedYear}`;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("B2C_Records");
    
    const columns = ["Invoice Number", "Date", "Customer Name", "Taxable Value", "CGST", "SGST", "IGST", "Total Value", "Rates"];
    
    const headerRow = sheet.addRow(columns);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    });

    gstr1Data.b2cRaw.forEach(inv => {
      sheet.addRow([
        inv.invoiceNo, inv.date, inv.customerName, inv.taxableValue, inv.cgst, inv.sgst, inv.igst || 0, inv.value, inv.rates?.join(", ")
      ]);
    });

    // Auto-width
    sheet.columns.forEach((column) => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) maxLength = columnLength;
      });
      column.width = maxLength < 12 ? 12 : maxLength + 2;
    });

    workbook.xlsx.writeBuffer().then((buffer) => {
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    });
  };

  const downloadGstr1Excel = () => {
    if (!gstr1Data) return;

    const fileName = `${branch?.gstin || "NO_GSTIN"}_GSTR1_${months[selectedMonth - 1]}_${selectedYear}`;
    
    const workbook = new ExcelJS.Workbook();
    
    // Helper to add styled sheet
    const addStyledSheet = (name, data, columns) => {
      const sheet = workbook.addWorksheet(name);
      
      // Add Headers with style
      const headerRow = sheet.addRow(columns);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF4F46E5" } // Indigo-600
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" }
        };
      });

      // Add Data
      data.forEach(row => {
        const values = columns.map(col => row[col]);
        sheet.addRow(values);
      });

      // Auto-width columns
      sheet.columns.forEach((column) => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) maxLength = columnLength;
        });
        column.width = maxLength < 12 ? 12 : maxLength + 2;
      });
    };

    // 1. B2B
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
    addStyledSheet("b2b,sez,de", b2bData, b2bCols);

    // 2. B2BA
    addStyledSheet("b2ba", [], ["GSTIN/UIN of Recipient", "Receiver Name", "Original Invoice Number", "Original Invoice date", "Revised Invoice Number", "Revised Invoice date", "Invoice Value", "Place Of Supply", "Reverse Charge", "Applicable % of Tax Rate", "Invoice Type", "E-Commerce GSTIN", "Rate", "Taxable Value", "Cess Amount"]);

    // 3. B2CL
    const b2clCols = ["Invoice Number", "Invoice date", "Invoice Value", "Place Of Supply", "Applicable % of Tax Rate", "Rate", "Taxable Value", "Cess Amount", "E-Commerce GSTIN"];
    const b2clData = (gstr1Data.b2cl || []).map(row => ({
      "Invoice Number": row.invoiceNo, "Invoice date": row.date, "Invoice Value": row.value, "Place Of Supply": row.placeOfSupply, "Applicable % of Tax Rate": row.applicablePercent, "Rate": row.rate, "Taxable Value": row.taxableValue, "Cess Amount": row.cess, "E-Commerce GSTIN": row.ecommerceGstin
    }));
    addStyledSheet("b2cl", b2clData, b2clCols);

    // 4. B2CS
    const b2csCols = ["Type", "Place Of Supply", "Applicable % of Tax Rate", "Rate", "Taxable Value", "Cess Amount", "E-Commerce GSTIN"];
    const b2csData = (gstr1Data.b2cs || []).map(row => ({
      "Type": row.type, "Place Of Supply": row.placeOfSupply, "Applicable % of Tax Rate": "", "Rate": row.rate, "Taxable Value": row.taxableValue, "Cess Amount": row.cess, "E-Commerce GSTIN": row.ecommerceGstin || ""
    }));
    addStyledSheet("b2cs", b2csData, b2csCols);

    // 5. CDNR
    const cdnrCols = ["GSTIN/UIN of Recipient", "Receiver Name", "Note Number", "Note Date", "Note Type", "Place Of Supply", "Reverse Charge", "Note Supply Type", "Note Value", "Applicable % of Tax Rate", "Rate", "Taxable Value", "Cess Amount"];
    const cdnrData = (gstr1Data.cdnr || []).map(row => ({
      "GSTIN/UIN of Recipient": row.gstin, "Receiver Name": row.customerName, "Note Number": row.noteNo, "Note Date": row.noteDate, "Note Type": row.noteType, "Place Of Supply": row.placeOfSupply, "Reverse Charge": row.reverseCharge, "Note Supply Type": row.noteSupplyType, "Note Value": row.noteValue, "Applicable % of Tax Rate": row.applicablePercent, "Rate": row.rate, "Taxable Value": row.taxableValue, "Cess Amount": row.cess
    }));
    addStyledSheet("cdnr", cdnrData, cdnrCols);

    // 6. CDNUR
    const cdnurCols = ["UR Type", "Note Number", "Note Date", "Note Type", "Place Of Supply", "Note Value", "Applicable % of Tax Rate", "Rate", "Taxable Value", "Cess Amount"];
    const cdnurData = (gstr1Data.cdnur || []).map(row => ({
      "UR Type": row.type, "Note Number": row.noteNo, "Note Date": row.noteDate, "Note Type": row.noteType, "Place Of Supply": row.placeOfSupply, "Note Value": row.noteValue, "Applicable % of Tax Rate": row.applicablePercent, "Rate": row.rate, "Taxable Value": row.taxableValue, "Cess Amount": row.cess
    }));
    addStyledSheet("cdnur", cdnurData, cdnurCols);

    // 7. EXEMP
    const exempCols = ["Description", "Nil Rated", "Exempted", "Non GST supplies"];
    const exempData = (gstr1Data.nilRated || []).map(row => ({
      "Description": row.description, "Nil Rated": row.nilRated, "Exempted": row.exempt, "Non GST supplies": row.nonGst
    }));
    addStyledSheet("exemp", exempData, exempCols);

    // 8. HSN
    const hsnCols = ["HSN", "Description", "UQC", "Total Quantity", "Total Value", "Rate", "Taxable Value", "Integrated Tax Amount", "Central Tax Amount", "State/UT Tax Amount", "Cess Amount"];
    const hsnB2B = (gstr1Data.hsnSummaryB2B || []).map(row => ({
      "HSN": row.hsn, "Description": row.description, "UQC": row.uqc, "Total Quantity": row.totalQty, "Total Value": row.totalValue, "Rate": row.rate, "Taxable Value": row.taxableValue, "Integrated Tax Amount": row.igst, "Central Tax Amount": row.cgst, "State/UT Tax Amount": row.sgst, "Cess Amount": row.cess
    }));
    addStyledSheet("hsn(b2b)", hsnB2B, hsnCols);
    
    // 8.1 HSN B2C
    const hsnB2C = (gstr1Data.hsnSummaryB2C || []).map(row => ({
      "HSN": row.hsn, "Description": row.description, "UQC": row.uqc, "Total Quantity": row.totalQty, "Total Value": row.totalValue, "Rate": row.rate, "Taxable Value": row.taxableValue, "Integrated Tax Amount": row.igst, "Central Tax Amount": row.cgst, "State/UT Tax Amount": row.sgst, "Cess Amount": row.cess
    }));
    addStyledSheet("hsn(b2c)", hsnB2C, hsnCols);

    // 9. DOCS
    const docCols = ["Nature of Document", "Sr. No. From", "Sr. No. To", "Total Number", "Cancelled"];
    const docData = (gstr1Data.docSummary || []).map(row => ({
      "Nature of Document": row.nature, "Sr. No. From": row.from, "Sr. No. To": row.to, "Total Number": row.total, "Cancelled": row.cancelled
    }));
    addStyledSheet("docs", docData, docCols);

    // Generate and Download
    workbook.xlsx.writeBuffer().then((buffer) => {
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    });
  };
  
  const downloadGstr1SummaryExcel = () => {
    if (!gstr1Data) return;

    const fileName = `${branch?.gstin || "NO_GSTIN"}_GSTR1_SUMMARY_${months[selectedMonth - 1]}_${selectedYear}`;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Filing_Summary");

    // Styling
    const headerStyle = {
      font: { bold: true, color: { argb: "FFFFFFFF" }, size: 11 },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } },
      alignment: { horizontal: "center", vertical: "middle" },
      border: { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } }
    };

    // 1. Report Title
    sheet.mergeCells("A1:E1");
    const title = sheet.getCell("A1");
    title.value = "GST FILING RECORD SUMMARY (GSTR-1)";
    title.font = { bold: true, size: 16, color: { argb: "FF1E293B" } };
    title.alignment = { horizontal: "center" };

    sheet.addRow([`Branch: ${branch?.name}`, "", "", `Period: ${months[selectedMonth - 1]} ${selectedYear}`]);
    sheet.addRow([`GSTIN: ${branch?.gstin}`, "", "", `Generated: ${new Date().toLocaleDateString()}`]);
    sheet.addRow([]);

    // 2. Main Summary Table
    const tableHeader = sheet.addRow(["SECTION", "PARTICULARS", "RECORD COUNT", "TAXABLE VALUE", "TOTAL TAX"]);
    tableHeader.eachCell(cell => { 
      Object.assign(cell, headerStyle);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    });

    const b2bTaxable = gstr1Data.b2b.reduce((s, r) => s + (r.taxableValue || 0), 0);
    const b2bTax = gstr1Data.b2b.reduce((s, r) => s + (r.igst || 0) + (r.cgst || 0) + (r.sgst || 0), 0);

    const b2cTaxable = (gstr1Data.b2cl || []).reduce((s, r) => s + (r.taxableValue || 0), 0) + (gstr1Data.b2cs || []).reduce((s, r) => s + (r.taxableValue || 0), 0);
    const b2cTax = (gstr1Data.b2cl || []).reduce((s, r) => s + (r.igst || 0) + (r.cgst || 0) + (r.sgst || 0), 0) + (gstr1Data.b2cs || []).reduce((s, r) => s + (r.igst || 0) + (r.cgst || 0) + (r.sgst || 0), 0);

    const cnTaxable = (gstr1Data.cdnr || []).reduce((s, r) => s + (r.taxableValue || 0), 0) + (gstr1Data.cdnur || []).reduce((s, r) => s + (r.taxableValue || 0), 0);
    const cnTax = (gstr1Data.cdnr || []).reduce((s, r) => s + (r.igst || 0) + (r.cgst || 0) + (r.sgst || 0), 0) + (gstr1Data.cdnur || []).reduce((s, r) => s + (r.igst || 0) + (r.cgst || 0) + (r.sgst || 0), 0);

    const nilTaxable = (gstr1Data.nilRated || []).reduce((s, r) => s + (r.nilRated || 0) + (r.exempt || 0) + (r.nonGst || 0), 0);

    sheet.addRow(["B2B", "Business to Business Supplies", gstr1Data.b2b.length, b2bTaxable, b2bTax]);
    sheet.addRow(["B2C", "Business to Consumer Supplies", gstr1Data.b2cRaw?.length || 0, b2cTaxable, b2cTax]);
    sheet.addRow(["Credit Note", "Registered & Unregistered Returns", (gstr1Data.cdnr?.length || 0) + (gstr1Data.cdnur?.length || 0), cnTaxable, cnTax]);
    sheet.addRow(["Nil Rated", "Exempted / Non-GST Supplies", gstr1Data.nilRated?.length || 0, nilTaxable, 0]);
    
    // 3. Rate-wise Breakdown
    sheet.addRow([]);
    const rateHeader = sheet.addRow(["SECTION", "TAX RATE", "ITEM COUNT", "TAXABLE VALUE", "TOTAL TAX"]);
    rateHeader.eachCell(cell => { 
      Object.assign(cell, headerStyle); 
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0891B2' } }; // Cyan-600
    });

    const gstRates = [0, 5, 12, 18, 28];
    
    // B2B Rates
    gstRates.forEach(rate => {
      const filtered = gstr1Data.b2b.filter(r => Math.round(r.rate) === rate);
      if (filtered.length > 0) {
        const taxable = filtered.reduce((s, r) => s + (r.taxableValue || 0), 0);
        const tax = filtered.reduce((s, r) => s + (r.igst || 0) + (r.cgst || 0) + (r.sgst || 0), 0);
        sheet.addRow(["B2B", `${rate}%`, filtered.length, taxable, tax]);
      }
    });

    // B2C Rates
    gstRates.forEach(rate => {
      const filteredS = (gstr1Data.b2cs || []).filter(r => Math.round(r.rate) === rate);
      const filteredL = (gstr1Data.b2cl || []).filter(r => Math.round(r.rate) === rate);
      if (filteredS.length > 0 || filteredL.length > 0) {
        const taxable = filteredS.reduce((s, r) => s + (r.taxableValue || 0), 0) + filteredL.reduce((s, r) => s + (r.taxableValue || 0), 0);
        const tax = filteredS.reduce((s, r) => s + (r.igst || 0) + (r.cgst || 0) + (r.sgst || 0), 0) + filteredL.reduce((s, r) => s + (r.igst || 0) + (r.cgst || 0) + (r.sgst || 0), 0);
        
        // Count unique invoices from b2cRaw that contain this specific rate
        const invCount = gstr1Data.b2cRaw?.filter(inv => inv.rates?.includes(rate)).length || 0;
        
        sheet.addRow(["B2C", `${rate}%`, invCount, taxable, tax]);
      }
    });

    // CDNR Rates
    gstRates.forEach(rate => {
      const filteredR = (gstr1Data.cdnr || []).filter(r => Math.round(r.rate) === rate);
      const filteredUR = (gstr1Data.cdnur || []).filter(r => Math.round(r.rate) === rate);
      if (filteredR.length > 0 || filteredUR.length > 0) {
        const taxable = filteredR.reduce((s, r) => s + (r.taxableValue || 0), 0) + filteredUR.reduce((s, r) => s + (r.taxableValue || 0), 0);
        const tax = filteredR.reduce((s, r) => s + (r.igst || 0) + (r.cgst || 0) + (r.sgst || 0), 0) + filteredUR.reduce((s, r) => s + (r.igst || 0) + (r.cgst || 0) + (r.sgst || 0), 0);
        sheet.addRow(["Credit Note", `${rate}%`, filteredR.length + filteredUR.length, taxable, tax]);
      }
    });

    // 4. Document Summary
    sheet.addRow([]);
    const docHeader = sheet.addRow(["NATURE OF DOCUMENT", "FROM", "TO", "TOTAL", "CANCELLED"]);
    docHeader.eachCell(cell => { 
      Object.assign(cell, headerStyle); 
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } }; 
    });

    (gstr1Data.docSummary || []).forEach(doc => {
      sheet.addRow([doc.nature, doc.from, doc.to, doc.total, doc.cancelled]);
    });

    // Formatting for Summary
    sheet.getColumn(4).numFmt = "₹#,##0.00";
    sheet.getColumn(5).numFmt = "₹#,##0.00";
    sheet.columns.forEach(col => col.width = 25);

    // --- NEW: Add Detailed Pages ---
    
    const addStyledSheet = (name, data, columns) => {
      const s = workbook.addWorksheet(name);
      const hRow = s.addRow(columns);
      hRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
      });
      data.forEach(row => {
        const values = columns.map(col => row[col]);
        s.addRow(values);
      });
      s.columns.forEach((column) => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) maxLength = columnLength;
        });
        column.width = maxLength < 12 ? 12 : (maxLength > 50 ? 50 : maxLength + 2);
      });
    };

    // 1. B2B Details
    const b2bCols = ["GSTIN", "Customer Name", "Invoice No", "Date", "Value", "POS", "Rate", "Taxable Value", "IGST", "CGST", "SGST"];
    const b2bData = gstr1Data.b2b.map(row => ({
      "GSTIN": row.gstin, "Customer Name": row.customerName, "Invoice No": row.invoiceNo, "Date": row.date, "Value": row.value, "POS": row.placeOfSupply, "Rate": row.rate, "Taxable Value": row.taxableValue, "IGST": row.igst, "CGST": row.cgst, "SGST": row.sgst
    }));
    addStyledSheet("B2B_Details", b2bData, b2bCols);

    // 2. B2C Details (Raw)
    const b2cCols = ["Invoice No", "Date", "Customer Name", "POS", "Value", "Taxable Value", "IGST", "CGST", "SGST", "Rates"];
    const b2cData = (gstr1Data.b2cRaw || []).map(row => ({
      "Invoice No": row.invoiceNo, "Date": row.date, "Customer Name": row.customerName, "POS": row.placeOfSupply, "Value": row.value, "Taxable Value": row.taxableValue, "IGST": row.igst, "CGST": row.cgst, "SGST": row.sgst, "Rates": (row.rates || []).join(", ")
    }));
    addStyledSheet("B2C_Retail_Details", b2cData, b2cCols);

    // 3. Credit Notes
    const cnCols = ["GSTIN", "Customer Name", "Note No", "Date", "Type", "POS", "Value", "Rate", "Taxable Value", "IGST", "CGST", "SGST"];
    const cnData = [...(gstr1Data.cdnr || []), ...(gstr1Data.cdnur || [])].map(row => ({
      "GSTIN": row.gstin, "Customer Name": row.customerName, "Note No": row.noteNo, "Date": row.noteDate, "Type": row.noteType, "POS": row.placeOfSupply, "Value": row.noteValue, "Rate": row.rate, "Taxable Value": row.taxableValue, "IGST": row.igst, "CGST": row.cgst, "SGST": row.sgst
    }));
    addStyledSheet("Credit_Notes", cnData, cnCols);

    // 4. HSN Summaries
    const hsnCols = ["HSN", "Description", "UQC", "Total Qty", "Total Value", "Rate", "Taxable Value", "IGST", "CGST", "SGST"];
    
    // Combined (Official Filing)
    const hsnCombined = [...(gstr1Data.hsnSummaryB2B || []), ...(gstr1Data.hsnSummaryB2C || [])].map(row => ({
      "HSN": row.hsn, "Description": row.description, "UQC": row.uqc, "Total Qty": row.totalQty, "Total Value": row.totalValue, "Rate": row.rate, "Taxable Value": row.taxableValue, "IGST": row.igst, "CGST": row.cgst, "SGST": row.sgst
    }));
    addStyledSheet("HSN_Combined", hsnCombined, hsnCols);

    // B2B Only
    const hsnB2B = (gstr1Data.hsnSummaryB2B || []).map(row => ({
      "HSN": row.hsn, "Description": row.description, "UQC": row.uqc, "Total Qty": row.totalQty, "Total Value": row.totalValue, "Rate": row.rate, "Taxable Value": row.taxableValue, "IGST": row.igst, "CGST": row.cgst, "SGST": row.sgst
    }));
    addStyledSheet("HSN_B2B", hsnB2B, hsnCols);

    // B2C Only
    const hsnB2C = (gstr1Data.hsnSummaryB2C || []).map(row => ({
      "HSN": row.hsn, "Description": row.description, "UQC": row.uqc, "Total Qty": row.totalQty, "Total Value": row.totalValue, "Rate": row.rate, "Taxable Value": row.taxableValue, "IGST": row.igst, "CGST": row.cgst, "SGST": row.sgst
    }));
    addStyledSheet("HSN_B2C", hsnB2C, hsnCols);

    workbook.xlsx.writeBuffer().then((buffer) => {
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    });
  };

  const downloadGstr1Json = () => {
    if (!gstr1Data) return;

    const formatPortalDate = (d) => {
      if (!d) return "";
      const parts = d.split("-");
      if (parts.length === 3 && isNaN(parts[1])) {
        const monthsMap = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
        return `${parts[0]}-${monthsMap[parts[1]] || "01"}-${parts[2]}`;
      }
      return d;
    };

    const b2bGroups = {};
    gstr1Data.b2b.forEach(row => {
      const gstin = row.gstin.trim().toUpperCase();
      const invNo = row.invoiceNo;
      if (!b2bGroups[gstin]) b2bGroups[gstin] = { ctin: gstin, inv: [] };
      let existingInv = b2bGroups[gstin].inv.find(i => i.inum === invNo);
      if (!existingInv) {
        existingInv = {
          inum: invNo, idt: formatPortalDate(row.date), val: parseFloat(row.value.toFixed(2)),
          pos: row.placeOfSupply.substring(0, 2), rchrg: row.reverseCharge || "N", inv_typ: "R", itms: []
        };
        b2bGroups[gstin].inv.push(existingInv);
      }
      existingInv.itms.push({
        num: existingInv.itms.length + 1,
        itm_det: { rt: parseFloat(row.rate.toFixed(2)), txval: parseFloat(row.taxableValue.toFixed(2)), iamt: parseFloat((row.igst || 0).toFixed(2)), camt: parseFloat((row.cgst || 0).toFixed(2)), samt: parseFloat((row.sgst || 0).toFixed(2)), csamt: parseFloat((row.cess || 0).toFixed(2)) }
      });
    });

    const cdnrGroups = {};
    gstr1Data.cdnr.forEach(row => {
      const gstin = row.gstin.trim().toUpperCase();
      const ntNo = row.noteNo;
      if (!cdnrGroups[gstin]) cdnrGroups[gstin] = { ctin: gstin, nt: [] };
      let existingNt = cdnrGroups[gstin].nt.find(n => n.nt_num === ntNo);
      if (!existingNt) {
        existingNt = {
          val: parseFloat(row.noteValue.toFixed(2)), ntty: row.noteType, nt_num: ntNo, nt_dt: formatPortalDate(row.noteDate),
          pos: row.placeOfSupply.substring(0, 2), rchrg: row.reverseCharge || "N", inv_typ: "R", itms: []
        };
        cdnrGroups[gstin].nt.push(existingNt);
      }
      existingNt.itms.push({
        num: existingNt.itms.length + 1,
        itm_det: { rt: parseFloat(row.rate.toFixed(2)), txval: parseFloat(row.taxableValue.toFixed(2)), iamt: parseFloat((row.igst || 0).toFixed(2)), camt: parseFloat((row.cgst || 0).toFixed(2)), samt: parseFloat((row.sgst || 0).toFixed(2)), csamt: parseFloat((row.cess || 0).toFixed(2)) }
      });
    });

    const hsn_b2b = (gstr1Data.hsnSummaryB2B || []).map((row, idx) => ({
      num: idx + 1, hsn_sc: String(row.hsn), txval: parseFloat(row.taxableValue.toFixed(2)),
      iamt: parseFloat((row.igst || 0).toFixed(2)), camt: parseFloat((row.cgst || 0).toFixed(2)),
      samt: parseFloat((row.sgst || 0).toFixed(2)), csamt: parseFloat((row.cess || 0).toFixed(2)),
      desc: "", user_desc: row.description || "", uqc: row.uqc?.split("-")[0] || "OTH",
      qty: parseFloat(row.totalQty.toFixed(2)), rt: parseFloat(row.rate.toFixed(2))
    }));

    const hsn_b2c = (gstr1Data.hsnSummaryB2C || []).map((row, idx) => ({
      num: idx + 1, hsn_sc: String(row.hsn), txval: parseFloat(row.taxableValue.toFixed(2)),
      iamt: parseFloat((row.igst || 0).toFixed(2)), camt: parseFloat((row.cgst || 0).toFixed(2)),
      samt: parseFloat((row.sgst || 0).toFixed(2)), csamt: parseFloat((row.cess || 0).toFixed(2)),
      desc: "", user_desc: row.description || "", uqc: row.uqc?.split("-")[0] || "OTH",
      qty: parseFloat(row.totalQty.toFixed(2)), rt: parseFloat(row.rate.toFixed(2))
    }));

    const portalJson = {
      gstin: branch?.gstin?.trim().toUpperCase() || "33DULPS2600Q4Z3",
      fp: `${String(selectedMonth).padStart(2, "0")}${selectedYear}`,
      cur_gt: 0,
      gt: 0,
      b2b: Object.values(b2bGroups),
      b2cs: gstr1Data.b2cs.map(row => ({
        typ: "OE", sply_ty: row.placeOfSupply.startsWith(branch?.stateCode || "33") ? "INTRA" : "INTER",
        rt: parseFloat(row.rate.toFixed(2)), pos: row.placeOfSupply.substring(0, 2),
        txval: parseFloat(row.taxableValue.toFixed(2)), iamt: parseFloat((row.igst || 0).toFixed(2)),
        camt: parseFloat((row.cgst || 0).toFixed(2)), samt: parseFloat((row.sgst || 0).toFixed(2)), csamt: parseFloat((row.cess || 0).toFixed(2))
      })),
      cdnr: Object.values(cdnrGroups),
      hsn: { hsn_b2b, hsn_b2c },
      exp: [],
      at: [],
      atadj: [],
      nil: {
        inv: gstr1Data.nilRated.map(row => ({
          sply_ty: (row.description.includes("Inter-State") ? "INTER" : "INTRA") + (row.description.includes("registered") ? "B2B" : "B2C"),
          nil_amt: parseFloat(row.nilRated.toFixed(2)), expt_amt: parseFloat(row.exempt.toFixed(2)), ngsup_amt: parseFloat(row.nonGst.toFixed(2))
        }))
      },
      doc_issue: {
        doc_det: gstr1Data.docSummary.map((doc, idx) => ({
          doc_num: idx + 1,
          docs: [{ num: 1, from: doc.from, to: doc.to, totnum: doc.total, cancel: doc.cancelled, net_issue: doc.net }]
        }))
      }
    };

    const blob = new Blob([JSON.stringify(portalJson, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${branch?.gstin || "NO_GSTIN"}_GSTR1_${months[selectedMonth - 1]}_${selectedYear}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };


  const downloadGstr1DirectPortalJson = () => {
    if (!gstr1Data) return;

    const formatPortalDate = (d) => {
      if (!d) return "";
      const parts = d.split("-");
      if (parts.length === 3 && isNaN(parts[1])) {
        const monthsMap = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
        return `${parts[0]}-${monthsMap[parts[1]] || "01"}-${parts[2]}`;
      }
      return d;
    };

    const b2bGroups = {};
    gstr1Data.b2b.forEach(row => {
      const gstin = row.gstin.trim().toUpperCase();
      const invNo = row.invoiceNo;
      if (!b2bGroups[gstin]) b2bGroups[gstin] = { ctin: gstin, inv: [] };
      let existingInv = b2bGroups[gstin].inv.find(i => i.inum === invNo);
      if (!existingInv) {
        existingInv = {
          inum: invNo, idt: formatPortalDate(row.date), val: parseFloat(row.value.toFixed(2)),
          pos: row.placeOfSupply.substring(0, 2), rchrg: row.reverseCharge || "N", inv_typ: "R", itms: []
        };
        b2bGroups[gstin].inv.push(existingInv);
      }
      existingInv.itms.push({
        num: existingInv.itms.length + 1,
        itm_det: { rt: parseFloat(row.rate.toFixed(2)), txval: parseFloat(row.taxableValue.toFixed(2)), iamt: parseFloat((row.igst || 0).toFixed(2)), camt: parseFloat((row.cgst || 0).toFixed(2)), samt: parseFloat((row.sgst || 0).toFixed(2)), csamt: parseFloat((row.cess || 0).toFixed(2)) }
      });
    });

    const cdnrGroups = {};
    gstr1Data.cdnr.forEach(row => {
      const gstin = row.gstin.trim().toUpperCase();
      const ntNo = row.noteNo;
      if (!cdnrGroups[gstin]) cdnrGroups[gstin] = { ctin: gstin, nt: [] };
      let existingNt = cdnrGroups[gstin].nt.find(n => n.nt_num === ntNo);
      if (!existingNt) {
        existingNt = {
          val: parseFloat(row.noteValue.toFixed(2)), ntty: row.noteType, nt_num: ntNo, nt_dt: formatPortalDate(row.noteDate),
          pos: row.placeOfSupply.substring(0, 2), p_gst: "N", rchrg: row.reverseCharge || "N", inv_typ: "R", itms: []
        };
        cdnrGroups[gstin].nt.push(existingNt);
      }
      existingNt.itms.push({
        num: existingNt.itms.length + 1,
        itm_det: { rt: parseFloat(row.rate.toFixed(2)), txval: parseFloat(row.taxableValue.toFixed(2)), iamt: parseFloat((row.igst || 0).toFixed(2)), camt: parseFloat((row.cgst || 0).toFixed(2)), samt: parseFloat((row.sgst || 0).toFixed(2)), csamt: parseFloat((row.cess || 0).toFixed(2)) }
      });
    });

    const hsnMap = {};
    [...(gstr1Data.hsnSummaryB2B || []), ...(gstr1Data.hsnSummaryB2C || [])].forEach(row => {
      const key = `${row.hsn}_${row.rate}_${row.uqc}`;
      if (!hsnMap[key]) {
        hsnMap[key] = { ...row };
      } else {
        hsnMap[key].totalQty += row.totalQty;
        hsnMap[key].totalValue += row.totalValue;
        hsnMap[key].taxableValue += row.taxableValue;
        hsnMap[key].igst += (row.igst || 0);
        hsnMap[key].cgst += (row.cgst || 0);
        hsnMap[key].sgst += (row.sgst || 0);
        hsnMap[key].cess += (row.cess || 0);
      }
    });

    const hsnData = Object.values(hsnMap).map((row, idx) => ({
      num: idx + 1,
      hsn_sc: String(row.hsn).padStart(4, '0'),
      desc: (row.description || "").substring(0, 30),
      uqc: row.uqc?.split("-")[0] || "OTH",
      qty: parseFloat(row.totalQty.toFixed(2)),
      val: parseFloat(row.totalValue.toFixed(2)),
      txval: parseFloat(row.taxableValue.toFixed(2)),
      iamt: parseFloat((row.igst || 0).toFixed(2)),
      camt: parseFloat((row.cgst || 0).toFixed(2)),
      samt: parseFloat((row.sgst || 0).toFixed(2)),
      csamt: parseFloat((row.cess || 0).toFixed(2))
    }));

    const portalJson = {
      gstin: branch?.gstin?.trim().toUpperCase() || "33DULPS2600Q4Z3",
      fp: `${String(selectedMonth).padStart(2, "0")}${selectedYear}`,
      cur_gt: 0,
      gt: 0,
      b2b: Object.values(b2bGroups),
      b2cs: gstr1Data.b2cs.map(row => ({
        typ: "OE", sply_ty: row.placeOfSupply.startsWith(branch?.stateCode || "33") ? "INTRA" : "INTER",
        rt: parseFloat(row.rate.toFixed(2)), pos: row.placeOfSupply.substring(0, 2),
        txval: parseFloat(row.taxableValue.toFixed(2)), iamt: parseFloat((row.igst || 0).toFixed(2)),
        camt: parseFloat((row.cgst || 0).toFixed(2)), samt: parseFloat((row.sgst || 0).toFixed(2)), csamt: parseFloat((row.cess || 0).toFixed(2))
      })),
      cdnr: Object.values(cdnrGroups),
      hsn: { data: hsnData },
      nil: {
        inv: gstr1Data.nilRated.map(row => ({
          sply_ty: (row.description.includes("Inter-State") ? "INTER" : "INTRA") + (row.description.includes("registered") ? "B2B" : "B2C"),
          nil_amt: parseFloat(row.nilRated.toFixed(2)), expt_amt: parseFloat(row.exempt.toFixed(2)), ngsup_amt: parseFloat(row.nonGst.toFixed(2))
        }))
      },
      doc_issue: {
        doc_det: gstr1Data.docSummary.map((doc) => {
          let docNum = 1; // Default for Invoices
          if (doc.nature.includes("Credit Note")) docNum = 5;
          else if (doc.nature.includes("Debit Note")) docNum = 4;
          return {
            doc_num: docNum,
            docs: [{ num: 1, from: doc.from, to: doc.to, totnum: doc.total, cancel: doc.cancelled, net_issue: doc.net }]
          };
        })
      }
    };

    const blob = new Blob([JSON.stringify(portalJson, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${branch?.gstin || "33DULPS2600Q4Z3"}_GSTR1_DIRECT_${months[selectedMonth - 1]}_${selectedYear}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadSectionJson = (sectionKey) => {
    if (!gstr1Data) return;
    
    const formatPortalDate = (d) => {
      if (!d) return "";
      const parts = d.split("-");
      if (parts.length === 3 && isNaN(parts[1])) {
        const monthsMap = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
        return `${parts[0]}-${monthsMap[parts[1]] || "01"}-${parts[2]}`;
      }
      return d;
    };

    let sectionData = null;
    let fileNamePart = sectionKey.toUpperCase();

    if (sectionKey === 'b2b') {
      const b2bGroups = {};
      gstr1Data.b2b.forEach(row => {
        const gstin = row.gstin.trim().toUpperCase();
        const invNo = row.invoiceNo;
        if (!b2bGroups[gstin]) b2bGroups[gstin] = { ctin: gstin, inv: [] };
        let existingInv = b2bGroups[gstin].inv.find(i => i.inum === invNo);
        if (!existingInv) {
          existingInv = {
            inum: invNo, idt: formatPortalDate(row.date), val: parseFloat(row.value.toFixed(2)),
            pos: row.placeOfSupply.substring(0, 2), rchrg: row.reverseCharge || "N", inv_typ: "R", itms: []
          };
          b2bGroups[gstin].inv.push(existingInv);
        }
        existingInv.itms.push({
          num: existingInv.itms.length + 1,
          itm_det: { rt: parseFloat(row.rate.toFixed(2)), txval: parseFloat(row.taxableValue.toFixed(2)), iamt: parseFloat((row.igst || 0).toFixed(2)), camt: parseFloat((row.cgst || 0).toFixed(2)), samt: parseFloat((row.sgst || 0).toFixed(2)), csamt: parseFloat((row.cess || 0).toFixed(2)) }
        });
      });
      sectionData = { b2b: Object.values(b2bGroups) };
    } else if (sectionKey === 'b2cs') {
      sectionData = {
        b2cs: gstr1Data.b2cs.map(row => ({
          typ: "OE", sply_ty: row.placeOfSupply.startsWith(branch?.stateCode || "33") ? "INTRA" : "INTER",
          rt: parseFloat(row.rate.toFixed(2)), pos: row.placeOfSupply.substring(0, 2),
          txval: parseFloat(row.taxableValue.toFixed(2)), iamt: parseFloat((row.igst || 0).toFixed(2)),
          camt: parseFloat((row.cgst || 0).toFixed(2)), samt: parseFloat((row.sgst || 0).toFixed(2)), csamt: parseFloat((row.cess || 0).toFixed(2))
        }))
      };
    } else if (sectionKey === 'cdnr') {
      const cdnrGroups = {};
      gstr1Data.cdnr.forEach(row => {
        const gstin = row.gstin.trim().toUpperCase();
        const ntNo = row.noteNo;
        if (!cdnrGroups[gstin]) cdnrGroups[gstin] = { ctin: gstin, nt: [] };
        let existingNt = cdnrGroups[gstin].nt.find(n => n.nt_num === ntNo);
        if (!existingNt) {
          existingNt = {
            val: parseFloat(row.noteValue.toFixed(2)), ntty: row.noteType, nt_num: ntNo, nt_dt: formatPortalDate(row.noteDate),
            pos: row.placeOfSupply.substring(0, 2), rchrg: row.reverseCharge || "N", inv_typ: "R", itms: []
          };
          cdnrGroups[gstin].nt.push(existingNt);
        }
        existingNt.itms.push({
          num: existingNt.itms.length + 1,
          itm_det: { rt: parseFloat(row.rate.toFixed(2)), txval: parseFloat(row.taxableValue.toFixed(2)), iamt: parseFloat((row.igst || 0).toFixed(2)), camt: parseFloat((row.cgst || 0).toFixed(2)), samt: parseFloat((row.sgst || 0).toFixed(2)), csamt: parseFloat((row.cess || 0).toFixed(2)) }
        });
      });
      sectionData = { cdnr: Object.values(cdnrGroups) };
    } else if (sectionKey === 'hsn') {
      const hsn_b2b = (gstr1Data.hsnSummaryB2B || []).map((row, idx) => ({
        num: idx + 1, hsn_sc: String(row.hsn), txval: parseFloat(row.taxableValue.toFixed(2)),
        iamt: parseFloat((row.igst || 0).toFixed(2)), camt: parseFloat((row.cgst || 0).toFixed(2)),
        samt: parseFloat((row.sgst || 0).toFixed(2)), csamt: parseFloat((row.cess || 0).toFixed(2)),
        desc: "", user_desc: row.description || "", uqc: row.uqc?.split("-")[0] || "OTH",
        qty: parseFloat(row.totalQty.toFixed(2)), rt: parseFloat(row.rate.toFixed(2))
      }));
      const hsn_b2c = (gstr1Data.hsnSummaryB2C || []).map((row, idx) => ({
        num: idx + 1, hsn_sc: String(row.hsn), txval: parseFloat(row.taxableValue.toFixed(2)),
        iamt: parseFloat((row.igst || 0).toFixed(2)), camt: parseFloat((row.cgst || 0).toFixed(2)),
        samt: parseFloat((row.sgst || 0).toFixed(2)), csamt: parseFloat((row.cess || 0).toFixed(2)),
        desc: "", user_desc: row.description || "", uqc: row.uqc?.split("-")[0] || "OTH",
        qty: parseFloat(row.totalQty.toFixed(2)), rt: parseFloat(row.rate.toFixed(2))
      }));
      sectionData = { hsn: { hsn_b2b, hsn_b2c } };
    } else if (sectionKey === 'nil') {
      sectionData = {
        nil: {
          inv: gstr1Data.nilRated.map(row => ({
            sply_ty: (row.description.includes("Inter-State") ? "INTER" : "INTRA") + (row.description.includes("registered") ? "B2B" : "B2C"),
            nil_amt: parseFloat(row.nilRated.toFixed(2)), expt_amt: parseFloat(row.exempt.toFixed(2)), ngsup_amt: parseFloat(row.nonGst.toFixed(2))
          }))
        }
      };
    } else if (sectionKey === 'doc_issue') {
      sectionData = {
        doc_issue: {
          doc_det: gstr1Data.docSummary.map((doc) => {
            let docNum = 1;
            if (doc.nature.includes("Credit Note")) docNum = 5;
            else if (doc.nature.includes("Debit Note")) docNum = 4;
            return {
              doc_num: docNum,
              docs: [{ num: 1, from: doc.from, to: doc.to, totnum: doc.total, cancel: doc.cancelled, net_issue: doc.net }]
            };
          })
        }
      };
    }

    if (!sectionData) return;

    const portalJson = {
      gstin: branch?.gstin?.trim().toUpperCase() || "33DULPS2600Q4Z3",
      fp: `${String(selectedMonth).padStart(2, "0")}${selectedYear}`,
      cur_gt: 0,
      gt: 0,
      ...sectionData
    };

    const blob = new Blob([JSON.stringify(portalJson, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${branch?.gstin || "33DULPS2600Q4Z3"}_GSTR1_${fileNamePart}_${months[selectedMonth - 1]}_${selectedYear}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadGstr3bExcel = () => {
    if (!gstr3bData || !gstr1Data) return;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("GSTR-3B_Compliance");
    const fileName = `${branch?.gstin || "NO_GSTIN"}_GSTR3B_${months[selectedMonth - 1]}_${selectedYear}`;

    // 1. Column Definitions
    sheet.columns = [
      { header: "", key: "a", width: 60 },
      { header: "", key: "b", width: 22 },
      { header: "", key: "c", width: 15 },
      { header: "", key: "d", width: 15 },
      { header: "", key: "e", width: 15 },
      { header: "", key: "f", width: 15 },
      { header: "", key: "g", width: 22 },
    ];

    // 2. High-End Business Header
    sheet.mergeCells("A1:G1");
    const agencyName = sheet.getCell("A1");
    agencyName.value = branch?.name || "PEARL AGENCY";
    agencyName.font = { bold: true, size: 20, color: { argb: "FF1E293B" } };
    agencyName.alignment = { horizontal: "center" };

    sheet.mergeCells("A2:G2");
    const agencyAddress = sheet.getCell("A2");
    agencyAddress.value = branch?.address || "Vannarpettai, Tirunelveli - 627003";
    agencyAddress.font = { size: 10, color: { argb: "FF64748B" } };
    agencyAddress.alignment = { horizontal: "center" };

    sheet.mergeCells("A3:G3");
    const agencyMeta = sheet.getCell("A3");
    agencyMeta.value = `GSTIN: ${branch?.gstin || ""} | Phone: ${branch?.phone || ""} | Email: ${branch?.email || ""}`;
    agencyMeta.font = { size: 10, italic: true, color: { argb: "FF64748B" } };
    agencyMeta.alignment = { horizontal: "center" };

    // 3. Report Info Section
    sheet.addRow([]);
    sheet.getRow(5).values = ["REPORT TYPE:", "GSTR-3B FILING HELPER"];
    sheet.getRow(5).font = { bold: true };
    sheet.getRow(6).values = ["PERIOD:", `${months[selectedMonth - 1]} ${selectedYear}`];
    sheet.getRow(6).font = { bold: true };
    sheet.getRow(7).values = ["GENERATED ON:", new Date().toLocaleDateString()];
    sheet.getRow(7).font = { size: 9 };

    // 4. Summary Cards (Visual Representation in Excel)
    sheet.addRow([]);
    const summaryRow = sheet.addRow(["VOUCHER SUMMARY", "COUNT"]);
    summaryRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    summaryRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
    });

    sheet.addRow(["Total Invoices Processed", gstr1Data.rawCounts.total || 0]);
    sheet.addRow(["Active Invoices (Included)", gstr1Data.rawCounts.total - gstr1Data.rawCounts.cancelled]);
    sheet.addRow(["Anomalies / Uncertain Transactions", gstr1Data.hsnSummary?.filter(h => ![4, 6, 8].includes(h.hsn.toString().length)).length || 0]);
    sheet.getCell("B12").font = { color: { argb: "FFEF4444" }, bold: true };

    // 5. TAX LIABILITY TABLE (Section 3.1)
    sheet.addRow([]);
    const liabilityHeader = sheet.addRow(["3.1 DETAILS OF OUTWARD SUPPLIES", "TAXABLE VAL", "", "IGST", "CGST", "SGST", "TOTAL TAX"]);
    liabilityHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
    liabilityHeader.alignment = { horizontal: "center" };
    liabilityHeader.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    });

    const out = gstr3bData.outwardSupplies;
    const outTax = (out.igst || 0) + (out.cgst || 0) + (out.sgst || 0);
    const row31a = sheet.addRow([
      "(a) Taxable Outward Supplies (Other than zero rated, nil rated and exempted)",
      out.taxable, "", out.igst, out.cgst, out.sgst, outTax
    ]);
    row31a.font = { bold: true };

    sheet.addRow(["(c) Other Outward Supplies (Nil rated, exempted)", out.nilRated, "", 0, 0, 0, 0]);

    // 6. ELIGIBLE ITC TABLE (Section 4)
    sheet.addRow([]);
    const itcHeader = sheet.addRow(["4. ELIGIBLE INPUT TAX CREDIT (ITC)", "", "", "IGST", "CGST", "SGST", "TOTAL ITC"]);
    itcHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
    itcHeader.alignment = { horizontal: "center" };
    itcHeader.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } }; // Emerald-600
    });

    const itc = gstr3bData.eligibleITC;
    const itcTax = (itc.igst || 0) + (itc.cgst || 0) + (itc.sgst || 0);
    const itcRow = sheet.addRow([
      "(A)(5) All other ITC (Purchases)",
      "", "", itc.igst, itc.cgst, itc.sgst, itcTax
    ]);
    itcRow.font = { bold: true };
    itcRow.getCell(1).font = { color: { argb: "FF059669" }, bold: true };

    // 7. FINAL NET PAYABLE
    sheet.addRow([]);
    const netRow = sheet.addRow(["NET TAX PAYABLE (Liability - ITC)", "", "", out.igst - itc.igst, out.cgst - itc.cgst, out.sgst - itc.sgst, outTax - itcTax]);
    netRow.font = { bold: true, size: 12 };
    netRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.border = { top: { style: 'medium' }, bottom: { style: 'medium' } };
    });

    // Formatting numbers and borders
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber >= 15) {
        [2, 4, 5, 6, 7].forEach(col => {
          const cell = row.getCell(col);
          if (typeof cell.value === 'number') {
            cell.numFmt = '₹#,##0.00';
          }
        });
      }
    });

    // Footer
    sheet.addRow([]);
    sheet.addRow(["* This is a system-generated summary helper for GST portal filing."]).font = { italic: true, size: 8, color: { argb: "FF94A3B8" } };

    workbook.xlsx.writeBuffer().then((buffer) => {
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName}_Professional.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    });
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
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={downloadGstr1Json}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition shadow-lg"
              >
                <FaDownload /> Download JSON (Offline Tool)
              </button>
              <button 
                onClick={downloadGstr1DirectPortalJson}
                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition shadow-lg"
              >
                <FaDownload /> Download JSON (Direct Website)
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {['b2b', 'b2cs', 'cdnr', 'hsn', 'nil', 'doc_issue'].map(sec => (
                <button 
                  key={sec}
                  onClick={() => downloadSectionJson(sec)}
                  className="bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase hover:bg-slate-50 transition"
                >
                  {sec.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
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

        {/* GSTR-3B Helper Section */}
        <div className="mt-12 mb-12">
           <div className="flex items-center justify-between mb-8">
              <div>
                 <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2 flex items-center gap-2">
                    <FaChartLine /> GSTR-3B Filing Helper (Copy-Paste Data)
                 </h2>
                 <p className="text-xs text-slate-500 font-bold uppercase tracking-tighter">Use these tables to fill your GSTR-3B return on the GST portal</p>
              </div>
              <button 
                onClick={downloadGstr3bExcel}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition shadow-lg bg-indigo-600 text-white hover:bg-indigo-700 border border-indigo-500"
              >
                <FaDownload /> Download 3B Excel
              </button>
           </div>

           <div className="grid grid-cols-1 gap-8">
              {/* Table 3.1 & Table 4 Combined View */}
              <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
                 <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-center">
                    <div>
                      <span className="text-[11px] font-black uppercase tracking-[0.2em] opacity-50">Section 3.1 & 4</span>
                      <h3 className="text-lg font-black uppercase tracking-tight">Tax Liability & ITC Summary</h3>
                    </div>
                    <div className="text-right">
                       <span className="text-[10px] font-black uppercase opacity-50">Net Tax Payable</span>
                       <p className="text-xl font-black text-emerald-400">
                          ₹{((gstr3bData?.outwardSupplies?.igst || 0) + (gstr3bData?.outwardSupplies?.cgst || 0) + (gstr3bData?.outwardSupplies?.sgst || 0) - ((gstr3bData?.eligibleITC?.igst || 0) + (gstr3bData?.eligibleITC?.cgst || 0) + (gstr3bData?.eligibleITC?.sgst || 0))).toLocaleString()}
                       </p>
                    </div>
                 </div>
                 
                 <div className="p-2 overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                       <thead>
                          <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                             <th className="px-8 py-5">Particulars / Table Ref</th>
                             <th className="px-6 py-5 text-right">Taxable Value</th>
                             <th className="px-6 py-5 text-right text-indigo-600">IGST</th>
                             <th className="px-6 py-5 text-right text-emerald-600">CGST</th>
                             <th className="px-6 py-5 text-right text-emerald-600">SGST/UTGST</th>
                             <th className="px-6 py-5 text-right font-black text-slate-900">Total Tax</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {/* 3.1(a) */}
                          <tr className="hover:bg-slate-50 transition-colors">
                             <td className="px-8 py-5">
                                <p className="text-[11px] font-black text-slate-800 uppercase">3.1(a) Outward Taxable Supplies</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">(Other than Nil/Exempt)</p>
                             </td>
                             <td className="px-6 py-5 text-[11px] font-black text-slate-900 text-right">₹{gstr3bData?.outwardSupplies?.taxable?.toLocaleString()}</td>
                             <td className="px-6 py-5 text-[11px] font-black text-indigo-600 text-right">₹{gstr3bData?.outwardSupplies?.igst?.toLocaleString()}</td>
                             <td className="px-6 py-5 text-[11px] font-black text-emerald-600 text-right">₹{gstr3bData?.outwardSupplies?.cgst?.toLocaleString()}</td>
                             <td className="px-6 py-5 text-[11px] font-black text-emerald-600 text-right">₹{gstr3bData?.outwardSupplies?.sgst?.toLocaleString()}</td>
                             <td className="px-6 py-5 text-[11px] font-black text-slate-900 text-right">₹{((gstr3bData?.outwardSupplies?.igst || 0) + (gstr3bData?.outwardSupplies?.cgst || 0) + (gstr3bData?.outwardSupplies?.sgst || 0)).toLocaleString()}</td>
                          </tr>
                          
                          {/* 4(A)(5) */}
                          <tr className="bg-indigo-50/30 hover:bg-indigo-50/50 transition-colors">
                             <td className="px-8 py-5 border-l-4 border-indigo-600">
                                <p className="text-[11px] font-black text-indigo-900 uppercase">4(A)(5) Eligible ITC (Purchases)</p>
                                <p className="text-[9px] font-bold text-indigo-400 uppercase mt-0.5">(All other ITC available)</p>
                             </td>
                             <td className="px-6 py-5 text-[11px] font-black text-slate-400 text-right">---</td>
                             <td className="px-6 py-5 text-[11px] font-black text-indigo-600 text-right">₹{gstr3bData?.eligibleITC?.igst?.toLocaleString()}</td>
                             <td className="px-6 py-5 text-[11px] font-black text-indigo-600 text-right">₹{gstr3bData?.eligibleITC?.cgst?.toLocaleString()}</td>
                             <td className="px-6 py-5 text-[11px] font-black text-indigo-600 text-right">₹{gstr3bData?.eligibleITC?.sgst?.toLocaleString()}</td>
                             <td className="px-6 py-5 text-[11px] font-black text-indigo-900 text-right">₹{((gstr3bData?.eligibleITC?.igst || 0) + (gstr3bData?.eligibleITC?.cgst || 0) + (gstr3bData?.eligibleITC?.sgst || 0)).toLocaleString()}</td>
                          </tr>

                          {/* 5 */}
                          <tr className="hover:bg-slate-50 transition-colors">
                             <td className="px-8 py-5">
                                <p className="text-[11px] font-black text-slate-800 uppercase">5. Exempt, Nil Rated Inward</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">(From Composition/Nil rated suppliers)</p>
                             </td>
                             <td className="px-6 py-5 text-[11px] font-black text-slate-900 text-right">₹{gstr3bData?.eligibleITC?.nilRated?.toLocaleString()}</td>
                             <td className="px-6 py-5 text-[11px] font-black text-slate-400 text-right">₹0.00</td>
                             <td className="px-6 py-5 text-[11px] font-black text-slate-400 text-right">₹0.00</td>
                             <td className="px-6 py-5 text-[11px] font-black text-slate-400 text-right">₹0.00</td>
                             <td className="px-6 py-5 text-[11px] font-black text-slate-400 text-right">₹0.00</td>
                          </tr>
                       </tbody>
                    </table>
                 </div>
                 <div className="bg-slate-50 px-8 py-4 flex items-center justify-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Live Data Synchronized with Database</span>
                 </div>
              </div>
           </div>
        </div>

        {/* B2C Sales Auditor */}
        <div className="mb-12">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
             <FaChartLine /> B2C Sales Auditor (Item-wise Verification)
          </h2>
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase">Rate-wise Breakdown</h3>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Compare these totals with your manual records</p>
              </div>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-5 gap-4">
              {[0, 5, 12, 18, 28].map(rate => {
                const totalForRate = gstr1Data?.b2cs?.find(b => b.rt === rate)?.txval || 0;
                const invoicesForRate = gstr1Data?.b2cRaw?.filter(inv => inv.rates.includes(rate)) || [];
                return (
                  <div key={rate} className={`p-6 rounded-3xl border ${totalForRate > 0 ? 'bg-slate-50 border-slate-200' : 'bg-slate-50/30 border-slate-100 opacity-50'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-xs font-black text-slate-900">{rate}% Rate</span>
                      <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">{invoicesForRate.length} Bills</span>
                    </div>
                    <p className="text-xl font-black text-slate-900">₹{totalForRate.toLocaleString()}</p>
                    {totalForRate > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-2">Sample Invoices:</p>
                        <div className="flex flex-wrap gap-1">
                          {invoicesForRate.slice(0, 5).map(inv => (
                            <span key={inv.invoiceNo} className="text-[8px] font-bold bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600">
                              #{inv.invoiceNo.split('/').pop()}
                            </span>
                          ))}
                          {invoicesForRate.length > 5 && <span className="text-[8px] font-bold text-slate-400">+{invoicesForRate.length - 5} more</span>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="bg-slate-900 p-4 text-center">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                 Total B2C Taxable Value: <span className="text-emerald-400 ml-2">₹{gstr1Data?.b2cs?.reduce((acc, b) => acc + b.txval, 0).toLocaleString()}</span>
               </p>
            </div>
          </div>
        </div>

        {/* Detailed B2C Verification List */}
        <div className="mb-20">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
             <FaChartLine /> Detailed B2C Verification List (Line-by-Line)
          </h2>
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">
                    <th className="px-6 py-4">Inv No</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4 text-right">Taxable Val</th>
                    <th className="px-6 py-4 text-right">CGST+SGST</th>
                    <th className="px-6 py-4 text-right">Grand Total</th>
                    <th className="px-6 py-4">Rates</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {gstr1Data?.b2cRaw?.map((inv, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3 text-[11px] font-black text-slate-900">{inv.invoiceNo}</td>
                      <td className="px-6 py-3 text-[10px] font-bold text-slate-500">{inv.date}</td>
                      <td className="px-6 py-3 text-[11px] font-black text-slate-900 text-right">₹{inv.taxableValue.toLocaleString()}</td>
                      <td className="px-6 py-3 text-[11px] font-bold text-emerald-600 text-right">₹{(inv.cgst + inv.sgst).toLocaleString()}</td>
                      <td className="px-6 py-3 text-[11px] font-black text-indigo-600 text-right">₹{inv.value.toLocaleString()}</td>
                      <td className="px-6 py-3">
                         <div className="flex gap-1">
                            {inv.rates.map(r => (
                              <span key={r} className="text-[8px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md">{r}%</span>
                            ))}
                         </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(!gstr1Data?.b2cRaw || gstr1Data.b2cRaw.length === 0) && (
               <div className="p-20 text-center">
                  <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No B2C Invoices found for this period</p>
               </div>
            )}
          </div>
        </div>

        {/* Tax Rate Auditor Section */}
        {gstr1Data && (
          <div className="mb-12 bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-xl shadow-slate-200/50">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Tax Rate Auditor</h2>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">
                  {filterRate ? `Showing Invoices for ${filterRate}% Rate` : 'Detecting billing anomalies & data entry errors'}
                </p>
              </div>
              <div className="flex gap-2">
                {/* Check for Unknown/Missing Data */}
                {([...(gstr1Data.hsnSummaryB2B || []), ...(gstr1Data.hsnSummaryB2C || [])].some(h => h.hsn === "9999" || h.description === "Unknown Product")) && (
                  <button 
                    onClick={() => setFilterRate('UNKNOWN')}
                    className={`px-4 py-2 rounded-xl border flex items-center gap-2 transition-all ${
                      filterRate === 'UNKNOWN' ? 'ring-2 ring-rose-500 bg-rose-600 text-white' : 'bg-rose-50 border-rose-200 text-rose-700 hover:scale-105'
                    }`}
                  >
                    <FaExclamationTriangle size={12} className={filterRate === 'UNKNOWN' ? "" : "animate-pulse"} />
                    <span className="text-[11px] font-black uppercase">Fix Unknown Items</span>
                  </button>
                )}
                {[0, 5, 12, 18, 28].map(rate => {
                   const hasRate = [...(gstr1Data.hsnSummaryB2B || []), ...(gstr1Data.hsnSummaryB2C || [])].some(h => Math.round(h.rate) === rate);
                   if (!hasRate) return null;
                   const isAnomalous = ![0, 5, 18].includes(rate);
                   return (
                     <button 
                       key={rate} 
                       onClick={() => setFilterRate(filterRate === rate ? null : rate)}
                       className={`px-4 py-2 rounded-xl border flex items-center gap-2 transition-all ${
                         filterRate === rate 
                         ? 'ring-2 ring-indigo-500 scale-105' 
                         : 'hover:scale-105'
                       } ${isAnomalous ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                     >
                        <span className="text-[11px] font-black">{rate}%</span>
                        {isAnomalous && <FaExclamationTriangle size={10} className={filterRate === rate ? "" : "animate-pulse"} />}
                        {filterRate === rate && <FaTimes size={8} className="ml-1" />}
                     </button>
                   );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {/* 12% Anomalies / Unknown Data */}
               {(filterRate === 'UNKNOWN' ? ['UNKNOWN'] : [12, 28]).map(badRate => {
                 const anomalousHsn = [...(gstr1Data?.hsnSummaryB2B || []), ...(gstr1Data?.hsnSummaryB2C || [])].filter(h => 
                    badRate === 'UNKNOWN' 
                    ? (h.hsn === "9999" || h.description === "Unknown Product" || h.description === "")
                    : Math.round(h.rate) === badRate
                 );
                 if (anomalousHsn.length === 0) return null;
                 return (
                   <div key={badRate} className="bg-rose-50/50 border border-rose-100 rounded-3xl p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs ${badRate === 'UNKNOWN' ? 'bg-rose-900' : 'bg-rose-600'}`}>
                           {badRate === 'UNKNOWN' ? '?' : `${badRate}%`}
                        </div>
                        <h3 className="text-xs font-black text-rose-900 uppercase tracking-widest">
                          {badRate === 'UNKNOWN' ? 'Incomplete Records' : `Detected in ${anomalousHsn.length} Items`}
                        </h3>
                      </div>
                      <div className="space-y-3">
                        {anomalousHsn.map((h, i) => (
                          <div key={i} className="bg-white p-3 rounded-xl border border-rose-100 shadow-sm">
                             <p className="text-[10px] font-black text-slate-800 uppercase">{h.description || "NO NAME"}</p>
                             <div className="flex flex-col gap-1 mt-2">
                               <div className="flex justify-between items-center">
                                 <span className="text-[9px] font-bold text-slate-400">HSN: {h.hsn}</span>
                                 <span className="text-[10px] font-black text-rose-600">₹{h.taxableValue.toLocaleString()}</span>
                               </div>
                               <p className="text-[8px] font-black text-indigo-500 uppercase tracking-tighter mt-1 bg-indigo-50/50 px-2 py-1 rounded-md border border-indigo-100">
                                 Check Bills: {h.invoiceNumbers?.join(", ") || "Unknown"}
                               </p>
                             </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-[9px] text-rose-400 font-bold uppercase mt-4 text-center">
                        {badRate === 'UNKNOWN' ? 'Fix these HSN/Names in Invoice Edit' : 'Check Invoice Items for these Products'}
                      </p>
                   </div>
                 );
               })}
               {![12, 28].some(r => [...(gstr1Data.hsnSummaryB2B || []), ...(gstr1Data.hsnSummaryB2C || [])].some(h => Math.round(h.rate) === r)) && filterRate !== 'UNKNOWN' && (
                 <div className="col-span-full py-10 flex flex-col items-center justify-center bg-emerald-50 rounded-3xl border border-emerald-100">
                    <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center text-white mb-3">
                      <FaCheckCircle size={20} />
                    </div>
                    <p className="text-sm font-black text-emerald-900 uppercase tracking-widest">No Rate Anomalies Detected</p>
                    <p className="text-[10px] text-emerald-600 font-bold uppercase mt-1">All sales are currently 0%, 5%, or 18%</p>
                 </div>
               )}
            </div>
          </div>
        )}

        {/* GSTR-1 Section */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
             <FaFileInvoice /> GSTR-1 Breakdown (Sales)
          </h2>
          <div className="flex gap-4">
            <button 
              onClick={downloadGstr1SummaryExcel}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition shadow-lg bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100"
            >
              <FaDownload /> Download Summary Excel
            </button>
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
            <button 
              onClick={downloadGstr1Json}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition shadow-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100"
            >
              <FaDownload /> Download Portal JSON
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* B2B Table */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">B2B Invoices</span>
              <div className="flex items-center gap-3">
                <button 
                  onClick={downloadB2BExcel_Standalone}
                  className="flex items-center gap-1.5 bg-white border border-slate-200 text-indigo-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase hover:bg-slate-50 transition shadow-sm"
                >
                  <FaDownload size={10} /> Excel
                </button>
                <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[9px] font-black">{gstr1Data?.b2b?.length || 0} Records</span>
              </div>
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
                  {gstr1Data?.b2b?.filter(row => !filterRate || Math.round(row.rate) === filterRate).map((row, idx) => (
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
           {/* B2C Table Explorer */}
           <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">B2C Invoices (Retail)</span>
              <div className="flex items-center gap-3">
                <button 
                  onClick={downloadB2CExcel_Standalone}
                  className="flex items-center gap-1.5 bg-white border border-slate-200 text-indigo-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase hover:bg-slate-50 transition shadow-sm"
                >
                  <FaDownload size={10} /> Excel
                </button>
                <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-[9px] font-black">{gstr1Data?.b2cRaw?.length || 0} Records</span>
              </div>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-white sticky top-0">
                  <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <th className="px-6 py-4">Invoice</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4 text-right">Taxable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {gstr1Data?.b2cRaw?.filter(row => !filterRate || row.rates?.includes(filterRate)).map((row, idx) => (
                    <tr key={idx} className={`hover:bg-slate-50 transition-all ${row.status === 'CANCELLED' ? 'opacity-50' : ''}`}>
                      <td className="px-6 py-4 text-[10px] font-black text-indigo-600">{row.invoiceNo}</td>
                      <td className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">{row.date}</td>
                      <td className="px-6 py-4 text-[10px] font-bold text-slate-700 uppercase truncate max-w-[150px]">{row.customerName}</td>
                      <td className="px-6 py-4 text-[10px] font-black text-slate-900 text-right">₹{row.taxableValue.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 flex flex-col items-center justify-center text-center">
             <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mb-4">
                <FaFileInvoice size={32} />
             </div>
             <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Need More Detail?</h3>
             <p className="text-xs text-slate-500 font-bold max-w-xs mt-2 uppercase tracking-tighter">
                Download the Portal JSON or Tally Excel to see the full line-item breakdown of every transaction for this period.
             </p>
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
