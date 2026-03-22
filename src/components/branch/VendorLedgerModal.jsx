import { useState, useEffect } from "react";
import { FaTimes, FaFileInvoiceDollar, FaDownload } from "react-icons/fa";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const VendorLedgerModal = ({ isOpen, onClose, supplier, purchaseOrders, payments }) => {
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    if (!supplier || !purchaseOrders || !payments) return;

    const txns = [];

    // Filter properties for this specific supplier
    const supplierPOs = purchaseOrders.filter((po) => {
      const poVendorName = po.vendor?.name || po.vendor;
      const isMatch = poVendorName === supplier.name;
      return isMatch && po.status === "INVOICED";
    });

    supplierPOs.forEach((po) => {
      // 1. Add the specific Purchase Order (Credit - Because we owe the supplier money)
      txns.push({
        id: `po-${po._id}`,
        date: po.createdAt || po.date,
        type: "INVOICE",
        particulars: `Purchase Invoice: ${po.invoiceId || "-"}`,
        paymentMethod: "-",
        debit: 0,
        credit: po.grandTotal || 0
      });

      // 2. Add all related payments for this order (Debit - Because we pay the supplier)
      const poPayments = payments.filter((payment) => {
        const rawId = payment.purchaseOrder?.poId;
        const paymentPoId = rawId?._id ? rawId._id.toString() : rawId?.toString();
        const oId = po._id?.toString();
        return paymentPoId === oId && payment.status === "completed";
      });

      poPayments.forEach((payment) => {
        txns.push({
          id: `pay-${payment._id}`,
          date: payment.createdAt || payment.paymentDate,
          type: "PAYMENT",
          particulars: `Payment: ${payment.receiptId || "-"} (PO: ${po.invoiceId || "-"})`,
          paymentMethod: payment.paymentMethod || "UNKNOWN",
          debit: payment.amount || 0,
          credit: 0
        });
      });
    });

    // Sort chronologically (oldest first) to calculate running balance correctly
    txns.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate running balance: Balance = Credit (what we owe) - Debit (what we paid)
    let currentBalance = 0; 
    
    const calculatedTxns = txns.map((txn) => {
      currentBalance = currentBalance + txn.credit - txn.debit;
      return {
        ...txn,
        balance: currentBalance
      };
    });

    setTransactions(calculatedTxns);

  }, [supplier, purchaseOrders, payments]);

  if (!isOpen || !supplier) return null;

  const handleExportPDF = async () => {
    const element = document.getElementById("vendor-ledger-content");
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
    pdf.save(`Ledger-${supplier.name}-${new Date().toLocaleDateString('en-IN')}.pdf`);
  };

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
              <h2 className="text-xl font-bold">Supplier Ledger</h2>
              <p className="text-teal-100 text-sm opacity-90">{supplier.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportPDF}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center gap-2 text-sm font-semibold border border-white/20"
            >
              <FaDownload /> PDF
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
        <div id="vendor-ledger-content" className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {/* Supplier Summary Header for PDF / Viewing */}
          <div className="bg-white border text-sm border-gray-200 rounded-xl p-6 mb-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center">
            <div>
              <h3 className="text-2xl font-black text-gray-800 uppercase tracking-tight">{supplier.name}</h3>
              <p className="text-gray-600 mt-1 font-medium">{supplier.address || "Address unavailable"} {supplier.state ? `, ${supplier.state}` : ""}</p>
              {(supplier.phone || supplier.email) && <p className="text-gray-600 font-medium text-sm mt-1">📞 {supplier.phone || supplier.email}</p>}
            </div>
            <div className="mt-4 md:mt-0 text-left md:text-right bg-teal-50 p-4 rounded-xl border border-teal-100">
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Current Outstanding owed TO supplier</p>
              <p className={`text-3xl font-black ${supplier.credit > supplier.debit ? 'text-red-600' : 'text-green-600'}`}>
                ₹{Math.max((supplier.credit || 0) - (supplier.debit || 0), 0).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-100 border-b border-gray-200 text-gray-600">
                  <tr>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Date</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Particulars</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Type</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs text-right">Debit (Paid)</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs text-right">Credit (Billed)</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs text-right bg-teal-50">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transactions.length > 0 ? (
                    transactions.map((txn, index) => (
                      <tr 
                        key={txn.id} 
                        className={`hover:bg-gray-50 transition-colors ${txn.type === 'PAYMENT' ? 'bg-green-50/30' : ''}`}
                      >
                        <td className="px-6 py-4 font-medium text-gray-700">
                          {new Date(txn.date).toLocaleDateString('en-IN', {
                            day: '2-digit', month: 'short', year: 'numeric'
                          })}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-gray-800">{txn.particulars}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                            txn.type === "INVOICE" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                          }`}>
                            {txn.type === "PAYMENT" ? (txn.paymentMethod || "PAYMENT").replace(/_/g, " ").toUpperCase() : txn.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-green-600">
                          {txn.debit > 0 ? `₹${txn.debit.toFixed(2)}` : "-"}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-gray-800">
                          {txn.credit > 0 ? `₹${txn.credit.toFixed(2)}` : "-"}
                        </td>
                        <td className="px-6 py-4 text-right font-black bg-teal-50/50 text-teal-800">
                          ₹{txn.balance.toFixed(2)} {txn.balance > 0 ? "Cr" : txn.balance < 0 ? "Dr" : ""}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-gray-500 bg-gray-50">
                        <div className="flex flex-col items-center justify-center">
                          <FaFileInvoiceDollar className="text-gray-300 text-4xl mb-3" />
                          <p className="text-lg font-medium">No transactions found</p>
                          <p className="text-sm">This supplier doesn't have any recorded orders or payments yet.</p>
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

export default VendorLedgerModal;
