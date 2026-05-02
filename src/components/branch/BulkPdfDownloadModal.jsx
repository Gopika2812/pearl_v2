import React, { useState } from "react";
import { FaTimes, FaFilePdf, FaDownload, FaCheckCircle } from "react-icons/fa";
import { API_BASE, fetchWithAuth } from "../../api";
import { toast } from "react-toastify";
import { useBranch } from "../../context/BranchContext";

const BATCH_SIZE = 10;

const BulkPdfDownloadModal = ({ show, onClose }) => {
  if (!show) return null;

  const { currentBranch } = useBranch();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, done: false });

  const triggerDownload = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleDownload = async () => {
    if (!currentBranch?._id) return;
    setDownloading(true);
    setProgress({ current: 0, total: 0, done: false });

    try {
      // Step 1: Get total count
      const countRes = await fetchWithAuth(`${API_BASE}/einvoice/bulk-pdf-count`, {
        method: "POST",
        body: JSON.stringify({
          branchId: currentBranch._id,
          month: selectedMonth,
          year: selectedYear,
        }),
      });
      const countData = await countRes.json();

      if (!countData.success || countData.total === 0) {
        toast.error("No generated E-Invoices found for this month.");
        setDownloading(false);
        return;
      }

      const total = countData.total;
      const totalBatches = Math.ceil(total / BATCH_SIZE);
      setProgress({ current: 0, total: totalBatches, done: false });

      // Step 2: Download each batch sequentially
      for (let page = 1; page <= totalBatches; page++) {
        setProgress((prev) => ({ ...prev, current: page }));
        toast.info(`Downloading Part ${page} of ${totalBatches}...`, { autoClose: 2000 });

        const res = await fetchWithAuth(`${API_BASE}/einvoice/bulk-pdf-download`, {
          method: "POST",
          body: JSON.stringify({
            branchId: currentBranch._id,
            month: selectedMonth,
            year: selectedYear,
            page,
            batchSize: BATCH_SIZE,
          }),
        });

        if (!res.ok) {
          console.warn(`Part ${page} failed with status ${res.status}`);
          continue;
        }

        const blob = await res.blob();
        const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        const monthLabel = monthNames[selectedMonth - 1];
        triggerDownload(blob, `EInvoices_${monthLabel}_${selectedYear}_Part${page}.pdf`);

        // Small delay between downloads so browser doesn't block
        await new Promise((r) => setTimeout(r, 600));
      }

      setProgress((prev) => ({ ...prev, done: true }));
      toast.success(`✅ All ${totalBatches} parts downloaded successfully!`);
    } catch (err) {
      console.error("Bulk PDF error:", err);
      toast.error("Error downloading PDFs: " + err.message);
    } finally {
      setDownloading(false);
    }
  };

  const months = [
    { value: 1, label: "January" }, { value: 2, label: "February" }, { value: 3, label: "March" },
    { value: 4, label: "April" }, { value: 5, label: "May" }, { value: 6, label: "June" },
    { value: 7, label: "July" }, { value: 8, label: "August" }, { value: 9, label: "September" },
    { value: 10, label: "October" }, { value: 11, label: "November" }, { value: 12, label: "December" },
  ];

  const progressPercent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

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
              <p className="text-[10px] opacity-80 font-bold uppercase tracking-widest">Downloads in parts of {BATCH_SIZE}</p>
            </div>
          </div>
          <button onClick={onClose} disabled={downloading} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition text-white disabled:opacity-40">
            <FaTimes />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-4">
          <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl text-rose-800 text-xs font-bold leading-relaxed">
            Each part contains {BATCH_SIZE} invoices. All parts will download automatically one by one into your browser's download folder.
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Select Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              disabled={downloading}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-rose-500 outline-none disabled:opacity-50"
            >
              {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Select Year</label>
            <input
              type="number"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              disabled={downloading}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-rose-500 outline-none disabled:opacity-50"
            />
          </div>

          {/* Progress Bar */}
          {downloading && progress.total > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
                  {progress.done ? "Complete!" : `Part ${progress.current} of ${progress.total}`}
                </span>
                <span className="text-xs font-black text-rose-600">{progressPercent}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-rose-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 font-bold text-center">
                Each part downloads automatically — check your Downloads folder
              </p>
            </div>
          )}

          {progress.done && (
            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl p-4">
              <FaCheckCircle className="text-emerald-600 shrink-0" size={20} />
              <p className="text-xs font-black text-emerald-700">
                All {progress.total} parts downloaded successfully!
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-0 flex gap-3">
          <button
            onClick={onClose}
            disabled={downloading}
            className="flex-1 py-3 rounded-xl font-black text-slate-500 hover:bg-slate-100 transition text-sm disabled:opacity-40"
          >
            {progress.done ? "Close" : "Cancel"}
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading || progress.done}
            className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-black shadow-lg shadow-rose-200 hover:bg-rose-700 transition flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:shadow-none"
          >
            {downloading ? (
              <>
                <FaDownload className="animate-bounce" />
                Downloading...
              </>
            ) : (
              <>
                <FaDownload />
                Start Download
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkPdfDownloadModal;
