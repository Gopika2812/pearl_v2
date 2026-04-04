import React, { useState } from "react";
import { FaTimes, FaDownload, FaCheckSquare, FaSquare } from "react-icons/fa";
import * as XLSX from "xlsx";

const COLUMNS_CONFIG = {
  GROUPS: [
    { label: "Stock Group Name", key: "name" },
    { label: "Inwards", key: "inwards" },
    { label: "Outwards", key: "outwards" },
    { label: "Closing Qty", key: "closingQty" },
    { label: "Closing Value", key: "closingValue" },
  ],
  ITEMS: [
    { label: "Product Name", key: "productName" },
    { label: "Opening Qty", key: "openingQty" },
    { label: "Inwards", key: "purchasesInPeriod" },
    { label: "Outwards", key: "salesInPeriod" },
    { label: "Closing Qty", key: "closingQty" },
    { label: "Closing Value", key: "closingValue" },
  ],
  LEDGER: [
    { label: "Date", key: "dateStr" },
    { label: "Voucher Type", key: "voucherType" },
    { label: "Invoice ID", key: "invoiceId" },
    { label: "Particulars", key: "particulars" },
    { label: "Inwards (Qty)", key: "inwardsQty" },
    { label: "Outwards (Qty)", key: "outwardsQty" },
  ]
};

const StockSummaryExportModal = ({ isOpen, onClose, viewLevel, data, title }) => {
  if (!isOpen) return null;

  const columns = COLUMNS_CONFIG[viewLevel] || [];
  const [selectedKeys, setSelectedKeys] = useState(columns.map(c => c.key));

  const toggleColumn = (key) => {
    if (selectedKeys.includes(key)) {
      setSelectedKeys(selectedKeys.filter(k => k !== key));
    } else {
      setSelectedKeys([...selectedKeys, key]);
    }
  };

  const handleExport = () => {
    if (selectedKeys.length === 0) {
      alert("Please select at least one column to export.");
      return;
    }

    // Prepare data for XLSX
    const exportData = data.map(item => {
      const row = {};
      columns.forEach(col => {
        if (selectedKeys.includes(col.key)) {
          let val = "";
          if (viewLevel === "ITEMS") {
            if (col.key === "openingQty") val = item.opening?.qty || 0;
            else if (col.key === "closingQty") val = item.closing?.qty || 0;
            else if (col.key === "closingValue") val = item.closing?.amount || 0;
            else val = item[col.key];
          } else if (viewLevel === "LEDGER") {
            if (col.key === "dateStr") val = item.date instanceof Date ? item.date.toLocaleDateString() : item.date;
            else if (col.key === "inwardsQty") val = item.type === "INWARD" ? item.qty : "";
            else if (col.key === "outwardsQty") val = item.type === "OUTWARD" ? item.qty : "";
            else val = item[col.key];
          } else {
            val = item[col.key];
          }
          row[col.label] = val;
        }
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Stock Summary");
    
    const fileName = `${title.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="bg-secondary p-6 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight">Export Options</h2>
            <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest mt-1">Select Columns to include</p>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-xl transition">
            <FaTimes />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          <div className="space-y-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
            {columns.map(col => (
              <div 
                key={col.key} 
                className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-100 hover:border-secondary/30 cursor-pointer transition capitalize"
                onClick={() => toggleColumn(col.key)}
              >
                <span className="text-xs font-black text-gray-600">{col.label}</span>
                {selectedKeys.includes(col.key) ? (
                  <FaCheckSquare className="text-secondary" />
                ) : (
                  <FaSquare className="text-gray-300" />
                )}
              </div>
            ))}
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest text-gray-400 hover:bg-gray-100 transition"
            >
              Cancel
            </button>
            <button 
              onClick={handleExport}
              className="flex-1 bg-secondary text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-secondary/20 hover:scale-[1.02] active:scale-95 transition flex items-center justify-center gap-2"
            >
              <FaDownload /> Download Excel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockSummaryExportModal;
