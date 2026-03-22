import React, { useMemo } from "react";
import { FaTimes, FaDownload, FaBoxOpen } from "react-icons/fa";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const AggregateSlipModal = ({ isOpen, onClose, orders }) => {
  // Aggregate items from all provided orders
  const aggregatedItems = useMemo(() => {
    if (!orders || orders.length === 0) return [];

    const itemMap = {};

    orders.forEach((order) => {
      // Aggregate regular items
      (order.items || []).forEach((item) => {
        if (!itemMap[item.name]) {
          itemMap[item.name] = {
            name: item.name,
            qty: 0,
            hsn: item.hsn || "-",
            isSample: false,
          };
        }
        itemMap[item.name].qty += Number(item.qty || 0);
      });

      // Aggregate sample items (we keep them separate for clarity as 'Sample')
      (order.sampleItems || []).forEach((item) => {
        const sampleName = `${item.name} (Sample)`;
        if (!itemMap[sampleName]) {
          itemMap[sampleName] = {
            name: sampleName,
            qty: 0,
            hsn: item.hsn || "-",
            isSample: true,
          };
        }
        itemMap[sampleName].qty += Number(item.qty || 0);
      });
    });

    // Convert map to sorted array
    return Object.values(itemMap).sort((a, b) => a.name.localeCompare(b.name));
  }, [orders]);

  if (!isOpen) return null;

  const handleExportPDF = async () => {
    const element = document.getElementById("aggregate-slip-content");
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
    pdf.save(`Packing-Slip-${new Date().toLocaleDateString("en-IN")}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-[100] flex justify-center items-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 px-6 py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3 text-white">
            <div className="p-2 bg-white/20 rounded-lg">
              <FaBoxOpen size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Consolidated Packing Slip</h2>
              <p className="text-indigo-100 text-sm opacity-90">
                Aggregated totals for {orders.length} selected orders
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportPDF}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center gap-2 text-sm font-semibold border border-white/20"
            >
              <FaDownload /> Print / PDF
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

        {/* Content */}
        <div id="aggregate-slip-content" className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <div className="bg-white border text-sm border-gray-200 rounded-xl p-6 mb-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center">
            <div>
              <h3 className="text-2xl font-black text-gray-800 uppercase tracking-tight">
                Picking Slip
              </h3>
              <p className="text-gray-600 mt-1 font-medium">
                Generated: {new Date().toLocaleString("en-IN")}
              </p>
            </div>
            <div className="mt-4 md:mt-0 text-left md:text-right bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex gap-6">
              <div>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Total Orders</p>
                <p className="text-2xl font-black text-indigo-700">{orders.length}</p>
              </div>
              <div className="border-l border-indigo-200 pl-6">
                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Total Unique Items</p>
                <p className="text-2xl font-black text-indigo-700">{aggregatedItems.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-100 border-b border-gray-200 text-gray-600">
                  <tr>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">S.No</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Product Name</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs text-center">HSN</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs text-right">Total Quantity Required</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {aggregatedItems.length > 0 ? (
                    aggregatedItems.map((item, index) => (
                      <tr key={index} className={`hover:bg-gray-50 transition-colors ${item.isSample ? "bg-yellow-50/50" : ""}`}>
                        <td className="px-6 py-4 font-medium text-gray-500">{index + 1}</td>
                        <td className="px-6 py-4">
                          <span className={`font-semibold ${item.isSample ? "text-yellow-700" : "text-gray-800"}`}>
                            {item.name}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center text-gray-600 font-mono text-xs">
                          {item.hsn}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="inline-flex items-center justify-center min-w-[3rem] px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 font-bold text-sm">
                            {item.qty}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="px-6 py-12 text-center text-gray-500 bg-gray-50">
                        <div className="flex flex-col items-center justify-center">
                          <FaBoxOpen className="text-gray-300 text-4xl mb-3" />
                          <p className="text-lg font-medium">No items found</p>
                          <p className="text-sm">There are no products in the selected orders.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AggregateSlipModal;
