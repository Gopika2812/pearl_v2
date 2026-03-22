import { useState, useEffect } from "react";
import { FaTimes, FaFileInvoiceDollar, FaPrint, FaDownload } from "react-icons/fa";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const CustomerLedgerModal = ({ isOpen, onClose, customer, salesOrders, customerPayments }) => {
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    if (!customer || !salesOrders || !customerPayments) return;

    const txns = [];

    // Filter properties for this specific customer
    const customerOrders = salesOrders.filter((o) => {
      const orderCustomerName = o.customer?.name || o.customer;
      const orderCustomerId = o.customer?.customerId || o.customer?.id || o.customer?._id;
      
      const isMatch = orderCustomerName === customer.name || orderCustomerId === customer._id;
      return isMatch && o.status !== "CANCELLED";
    });

    customerOrders.forEach((order) => {
      // 1. Add the specific Sales Order (Debit)
      txns.push({
        id: `so-${order._id}`,
        date: order.createdAt || order.orderDate,
        type: "INVOICE",
        particulars: `Sales Invoice: ${order.invoiceId || "-"}`,
        paymentMethod: "-",
        debit: order.grandTotal || 0,
        credit: 0
      });

      // 2. Add all related payments for this order (Credit)
      const orderPayments = customerPayments.filter((payment) => {
        const pOrderId = payment.originalSalesOrderId?.$oid || payment.originalSalesOrderId || payment.salesOrder?.soId || payment.orderId;
        const oId = order._id?.toString();
        const oSalesOrderId = order.salesOrderId?.$oid || order.salesOrderId;
        
        const isIdMatch = pOrderId && (pOrderId.toString() === oId || (oSalesOrderId && pOrderId.toString() === oSalesOrderId.toString()));
        
        const pInvId = payment.originalInvoiceId || payment.invoiceId || payment.receiptId;
        const oInvId = order.invoiceId || order.invoiceNumber || order.originalInvoiceId;
        const isInvMatch = typeof pInvId === 'string' && typeof oInvId === 'string' && pInvId === oInvId;
        
        const matchesOrder = isIdMatch || isInvMatch;
        const validStatus = payment.status === "completed" || payment.status === "confirmed" || payment.status === "bounced" || payment.paymentMethod === "BOUNCED";
        return matchesOrder && validStatus;
      });

      orderPayments.forEach((payment) => {
        const isBounce = payment.paymentMethod === "BOUNCED";
        txns.push({
          id: `pay-${payment._id}`,
          date: payment.createdAt || payment.paymentDate,
          type: isBounce ? "BOUNCE" : "RECEIPT",
          particulars: isBounce ? `Cheque Bounced (Inv: ${order.invoiceId || "-"})` : `Receipt: ${payment.receiptId || "-"} (Inv: ${order.invoiceId || "-"})`,
          paymentMethod: payment.paymentMethod || "UNKNOWN",
          debit: isBounce ? payment.amount : 0,
          credit: isBounce ? 0 : payment.amount || 0
        });
      });
    });

    // Sort chronologically (oldest first) to calculate running balance correctly
    txns.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate running balance using openingBalance + debit - credit
    let currentBalance = 0; // Assuming customer.totalBalance is opening balance? Usually we start from 0 if we fetch all historical orders.
    // If the ERP stores opening balance separately, we could add it here.
    
    const calculatedTxns = txns.map((txn) => {
      currentBalance = currentBalance + txn.debit - txn.credit;
      return {
        ...txn,
        balance: currentBalance
      };
    });

    // Reverse for UI so newest is at top, or keep oldest top? Typically ledgers show oldest at top or newest depending on user preference. 
    // We will show oldest at top for chronological reading.
    setTransactions(calculatedTxns);

  }, [customer, salesOrders, customerPayments]);

  if (!isOpen || !customer) return null;

  const handleExportPDF = async () => {
    const element = document.getElementById("ledger-content");
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
    pdf.save(`Ledger-${customer.name}-${new Date().toLocaleDateString('en-IN')}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-[100] flex justify-center items-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 to-blue-800 px-6 py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3 text-white">
            <div className="p-2 bg-white/20 rounded-lg">
              <FaFileInvoiceDollar size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Account Ledger</h2>
              <p className="text-blue-100 text-sm opacity-90">{customer.name}</p>
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
        <div id="ledger-content" className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {/* Customer Summary Header for PDF / Viewing */}
          <div className="bg-white border text-sm border-gray-200 rounded-xl p-6 mb-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center">
            <div>
              <h3 className="text-2xl font-black text-gray-800 uppercase tracking-tight">{customer.name}</h3>
              <p className="text-gray-600 mt-1 font-medium">{customer.address || "Address unavailable"} {customer.state ? `, ${customer.state}` : ""}</p>
              {(customer.whatsapp || customer.phone) && <p className="text-gray-600 font-medium text-sm mt-1">📞 {customer.whatsapp || customer.phone}</p>}
            </div>
            <div className="mt-4 md:mt-0 text-left md:text-right bg-blue-50 p-4 rounded-xl border border-blue-100">
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Current Outstanding</p>
              <p className={`text-3xl font-black ${customer.debit > customer.credit ? 'text-red-600' : 'text-green-600'}`}>
                ₹{Math.max((customer.debit || 0) - (customer.credit || 0), 0).toFixed(2)}
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
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs text-right">Debit (Amount)</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs text-right">Credit (Paid)</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs text-right bg-blue-50">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transactions.length > 0 ? (
                    transactions.map((txn, index) => (
                      <tr 
                        key={txn.id} 
                        className={`hover:bg-gray-50 transition-colors ${txn.type === 'RECEIPT' ? 'bg-green-50/30' : ''}`}
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
                            {txn.type === "RECEIPT" ? txn.paymentMethod : "INVOICE"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-gray-800">
                          {txn.debit > 0 ? `₹${txn.debit.toFixed(2)}` : "-"}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-green-600">
                          {txn.credit > 0 ? `₹${txn.credit.toFixed(2)}` : "-"}
                        </td>
                        <td className="px-6 py-4 text-right font-black bg-blue-50/50 text-blue-800">
                          ₹{txn.balance.toFixed(2)} {txn.balance > 0 ? "Dr" : txn.balance < 0 ? "Cr" : ""}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-gray-500 bg-gray-50">
                        <div className="flex flex-col items-center justify-center">
                          <FaFileInvoiceDollar className="text-gray-300 text-4xl mb-3" />
                          <p className="text-lg font-medium">No transactions found</p>
                          <p className="text-sm">This customer doesn't have any recorded orders or payments yet.</p>
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

export default CustomerLedgerModal;
