import React, { useMemo } from "react";
import { FaTimes, FaDownload, FaBoxOpen, FaUserFriends, FaClipboardList } from "react-icons/fa";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const AggregateSlipModal = ({ isOpen, onClose, orders, branch }) => {
  // Aggregate items and customer data from all provided orders
  const { aggregatedItems, customerSummary } = useMemo(() => {
    if (!orders || orders.length === 0) return { aggregatedItems: [], customerSummary: [] };

    const itemMap = {};
    const customerMap = {};

    orders.forEach((order) => {
      // 1. Aggregate Products
      const allItems = [...(order.items || []), ...(order.sampleItems || []).map(i => ({...i, isSample: true}))];
      
      allItems.forEach((item) => {
        const key = item.isSample ? `${item.name} (Sample)` : item.name;
        if (!itemMap[key]) {
          itemMap[key] = {
            name: key,
            qty: 0,
            unit: item.unit || "Unit",
            altQty: 0,
            altUnit: item.altUnit || "",
            hsn: item.hsn || "-",
            isSample: item.isSample || false,
          };
        }
        itemMap[key].qty += Number(item.qty || 0);
        itemMap[key].altQty += Number(item.altQty || 0);
      });

      // 2. Aggregate Customers
      const custName = order.customer?.name || "Unknown Customer";
      if (!customerMap[custName]) {
        customerMap[custName] = {
          name: custName,
          orders: []
        };
      }
      customerMap[custName].orders.push(order.invoiceId);
    });

    return {
      aggregatedItems: Object.values(itemMap).sort((a, b) => a.name.localeCompare(b.name)),
      customerSummary: Object.values(customerMap).sort((a, b) => a.name.localeCompare(b.name))
    };
  }, [orders]);

  if (!isOpen) return null;

  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(16);
    doc.setTextColor(33, 37, 41);
    doc.setFont("helvetica", "bold");
    doc.text(branch?.name || "PEARLS ERP", 14, 15);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(branch?.address || "", 14, 20);
    doc.text(`GSTIN: ${branch?.gstNumber || "N/A"}`, 14, 25);
    
    doc.setDrawColor(200);
    doc.line(14, 28, 196, 28);

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("CONSOLIDATED LOADING SLIP", 14, 38);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Date: ${new Date().toLocaleDateString("en-IN")}`, 14, 43);
    doc.text(`Total Bills: ${orders.length}`, 14, 48);
    
    // 1. PRODUCT SUMMARY TABLE
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("PRODUCT-WISE SUMMARY", 14, 58);

    autoTable(doc, {
      head: [["S.No", "Item Name", "Total Quantity Required"]],
      body: aggregatedItems.map((item, index) => [
        index + 1,
        item.name,
        `${item.qty} ${item.unit}${item.altQty > 0 ? ` (${item.altQty} ${item.altUnit})` : ""}`
      ]),
      startY: 62,
      theme: 'grid',
      headStyles: { fillColor: [49, 155, 171], fontSize: 9 },
      bodyStyles: { fontSize: 8 },
    });

    // 2. CUSTOMER SUMMARY TABLE
    const finalY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("CUSTOMER-WISE DISPATCH LIST", 14, finalY);

    autoTable(doc, {
      head: [["S.No", "Customer Name", "Sales Order ID(s)"]],
      body: customerSummary.map((cust, index) => [
        index + 1,
        cust.name,
        cust.orders.join(", ")
      ]),
      startY: finalY + 4,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], fontSize: 9 }, // Indigo-600 ish
      bodyStyles: { fontSize: 8 },
    });

    doc.save(`Loading-Slip-${new Date().toLocaleDateString("en-IN")}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-[100] flex justify-center items-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="bg-indigo-700 px-6 py-4 flex justify-between items-center shrink-0 shadow-lg">
          <div className="flex items-center gap-3 text-white">
            <div className="p-2 bg-white/20 rounded-lg">
              <FaBoxOpen size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Consolidated Loading Slip</h2>
              <p className="text-indigo-100 text-xs opacity-90">
                {branch?.name} • {new Date().toLocaleDateString("en-IN")}
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
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 space-y-6">
          
          {/* TOP STATS & BRANCH INFO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
               <h4 className="text-[10px] uppercase tracking-widest font-black text-gray-400 mb-2">Dispatch Branch</h4>
               <p className="text-lg font-black text-gray-800">{branch?.name}</p>
               <p className="text-xs text-gray-500 mt-1">{branch?.address}</p>
               <p className="text-[10px] font-bold text-indigo-600 mt-2 uppercase tracking-tight">GSTIN: {branch?.gstNumber}</p>
            </div>
            <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-5 rounded-2xl shadow-md text-white flex justify-around items-center text-center">
               <div>
                  <p className="text-[10px] uppercase font-bold opacity-70 mb-1">Total Bills</p>
                  <p className="text-3xl font-black">{orders.length}</p>
               </div>
               <div className="w-px h-8 bg-white/20"></div>
               <div>
                  <p className="text-[10px] uppercase font-bold opacity-70 mb-1">Unique Items</p>
                  <p className="text-3xl font-black">{aggregatedItems.length}</p>
               </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            
            {/* 1. PRODUCT SECTION */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b flex items-center gap-2">
                <FaClipboardList className="text-indigo-600" />
                <h3 className="font-black text-gray-800 text-sm uppercase tracking-tight">Product-Wise Summary</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-teal-50/50 border-b border-gray-100 text-teal-800">
                    <tr>
                      <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">S.No</th>
                      <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">Product Name</th>
                      <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px] text-right">Qty Required</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {aggregatedItems.map((item, index) => (
                      <tr key={index} className={`hover:bg-gray-50 transition-colors ${item.isSample ? "bg-yellow-50/30" : ""}`}>
                        <td className="px-6 py-3 font-medium text-gray-400 text-xs">{index + 1}</td>
                        <td className="px-6 py-3">
                          <span className={`font-bold ${item.isSample ? "text-yellow-700" : "text-gray-800"}`}>
                            {item.name}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-black text-xs border border-indigo-100">
                            {item.qty} {item.unit}
                            {item.altQty > 0 && <span className="ml-1 opacity-70">({item.altQty} {item.altUnit})</span>}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. CUSTOMER SECTION */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b flex items-center gap-2">
                <FaUserFriends className="text-indigo-600" />
                <h3 className="font-black text-gray-800 text-sm uppercase tracking-tight">Customer-Wise dispatch List</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-indigo-50/50 border-b border-gray-100 text-indigo-800">
                    <tr>
                      <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">S.No</th>
                      <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">Customer Name</th>
                      <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">Order ID(s) / Invoice(s)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {customerSummary.map((cust, index) => (
                      <tr key={index} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-3 font-medium text-gray-400 text-xs">{index + 1}</td>
                        <td className="px-6 py-3">
                          <span className="font-black text-gray-700 uppercase text-xs">{cust.name}</span>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex flex-wrap gap-1">
                            {cust.orders.map(id => (
                              <span key={id} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-bold border border-gray-200">
                                {id}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
        
        {/* Footer */}
        <div className="bg-white border-t px-6 py-4 flex justify-between items-center shrink-0">
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider italic">
            Total Bills to Dispatch: <span className="text-indigo-600">{orders.length}</span>
          </p>
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-black transition-all"
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
};

export default AggregateSlipModal;
