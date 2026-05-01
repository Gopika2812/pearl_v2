import React, { useState } from "react";
import { FaTimes, FaFilePdf, FaDownload } from "react-icons/fa";
import { API_BASE, fetchWithAuth } from "../../api";
import { toast } from "react-toastify";
import { useBranch } from "../../context/BranchContext";

const BulkPdfDownloadModal = ({ show, onClose }) => {
  if (!show) return null;

  const { currentBranch } = useBranch();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!currentBranch?._id) return;
    setDownloading(true);
    
    try {
      const res = await fetchWithAuth(`${API_BASE}/einvoice/bulk-pdf-download`, {
        method: 'POST',
        body: JSON.stringify({
          branchId: currentBranch._id,
          month: selectedMonth,
          year: selectedYear
        })
      });
      
      if (!res.ok) {
        if (res.status === 404) {
          toast.error("No generated E-Invoices found for this month.");
        } else {
          toast.error("Failed to merge PDFs. Server error.");
        }
        setDownloading(false);
        return;
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Merged_EInvoices_${selectedMonth}_${selectedYear}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success("Download complete!");
      onClose();
    } catch (err) {
      toast.error("Error connecting to server to download PDFs");
    } finally {
      setDownloading(false);
    }
  };

  const months = [
    { value: 1, label: "January" }, { value: 2, label: "February" }, { value: 3, label: "March" },
    { value: 4, label: "April" }, { value: 5, label: "May" }, { value: 6, label: "June" },
    { value: 7, label: "July" }, { value: 8, label: "August" }, { value: 9, label: "September" },
    { value: 10, label: "October" }, { value: 11, label: "November" }, { value: 12, label: "December" }
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] w-full max-w-md flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-rose-600 p-6 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <FaFilePdf size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight">Bulk PDF Download</h2>
              <p className="text-[10px] opacity-80 font-bold uppercase tracking-widest">Merge month's invoices</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition text-white">
            <FaTimes />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-4">
          <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl text-rose-800 text-xs font-bold leading-relaxed">
            This will fetch all generated E-Invoices for the selected month and merge them into a single printable PDF file. This may take a moment.
          </div>
          
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Select Month</label>
            <select 
              value={selectedMonth} 
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-rose-500 outline-none"
            >
              {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Select Year</label>
            <input 
              type="number" 
              value={selectedYear} 
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-rose-500 outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-0 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl font-black text-slate-500 hover:bg-slate-100 transition text-sm">Cancel</button>
          <button 
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-black shadow-lg shadow-rose-200 hover:bg-rose-700 transition flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:shadow-none"
          >
            {downloading ? <FaDownload className="animate-spin" /> : <FaDownload />}
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkPdfDownloadModal;
