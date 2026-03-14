import { useEffect, useState } from "react";
import { FaTimes } from "react-icons/fa";
import { toast } from "react-toastify";
import { useBranch } from "../../context/BranchContext";

const API_BASE = import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}/api` : "https://pearls-erp-2026.onrender.com/api";

export default function CreditNoteModal({ invoice, isOpen, onClose, onCreditNoteSuccess }) {
  const { currentBranch } = useBranch();
  const [selectedItems, setSelectedItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (isOpen && invoice?.items) {
      // Initialize items with returnedQty property
      const itemsWithReturnQty = invoice.items.map((item) => ({
        ...item,
        returnedQty: 0,
      }));
      setSelectedItems(itemsWithReturnQty);
      setReason("");
    }
  }, [isOpen, invoice]);

  const handleReturnedQtyChange = (index, value) => {
    const numValue = Math.max(0, parseInt(value) || 0);
    const maxQty = selectedItems[index].qty;

    if (numValue > maxQty) {
      toast.warning(`Cannot return more than ${maxQty} units`);
      return;
    }

    const updated = [...selectedItems];
    updated[index].returnedQty = numValue;
    setSelectedItems(updated);
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let totalTax = 0;
    let totalReturned = 0;

    selectedItems.forEach((item) => {
      if (item.returnedQty > 0) {
        const itemReturnValue = (item.sellingPrice || 0) * item.returnedQty;
        const itemTax = (item.total / item.qty) * item.returnedQty;
        
        subtotal += itemReturnValue;
        totalTax += itemTax;
        totalReturned += itemReturnValue + itemTax;
      }
    });

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      grandTotal: Math.round(totalReturned * 100) / 100,
      totalReturned: Math.round(totalReturned * 100) / 100,
    };
  };

  const handleCreateCreditNote = async () => {
    const anyReturned = selectedItems.some((item) => item.returnedQty > 0);
    if (!anyReturned) {
      toast.warning("Please select items to return");
      return;
    }

    if (!reason.trim()) {
      toast.warning("Please provide a reason for return");
      return;
    }

    setSaving(true);
    try {
      // Create credit note in database
      // Backend expects: originalSalesOrderId, items (with _id and qty), reasonForReturn
      const creditNotePayload = {
        originalSalesOrderId: invoice._id,
        items: selectedItems
          .filter((item) => item.returnedQty > 0)
          .map((item) => ({
            _id: item._id,  // Original item ID from sales order
            qty: item.returnedQty,  // Quantity being returned
          })),
        reasonForReturn: reason,
      };

      const creditNoteResponse = await fetch(`${API_BASE}/credit-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creditNotePayload),
      });

      if (!creditNoteResponse.ok) {
        const errorData = await creditNoteResponse.json();
        throw new Error(errorData.message || "Failed to create credit note");
      }

      const result = await creditNoteResponse.json();
      
      // Backend automatically increases customer credit

      toast.success("Credit note created successfully!");
      onCreditNoteSuccess();
    } catch (error) {
      console.error("Error creating credit note:", error);
      toast.error(error.message || "Failed to create credit note");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !invoice) return null;

  const totals = calculateTotals();
  const customerName =
    typeof invoice.customer === "object" ? invoice.customer.name : invoice.customer;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white p-6 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-bold">Create Credit Note</h2>
            <p className="text-teal-100 text-sm">Return items from sales invoice</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-teal-800 p-2 rounded-lg transition"
          >
            <FaTimes className="text-2xl" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* INVOICE DETAIL */}
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-600 uppercase text-xs font-bold">Invoice ID</p>
                <p className="font-bold text-teal-600">{invoice.invoiceId}</p>
              </div>
              <div>
                <p className="text-gray-600 uppercase text-xs font-bold">Customer</p>
                <p className="font-bold text-gray-800">{customerName}</p>
              </div>
              <div>
                <p className="text-gray-600 uppercase text-xs font-bold">Invoice Total</p>
                <p className="font-bold text-gray-800">₹{(invoice.grandTotal || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-600 uppercase text-xs font-bold">Date</p>
                <p className="font-bold text-gray-800">
                  {new Date(invoice.date || invoice.createdAt).toLocaleDateString("en-IN")}
                </p>
              </div>
            </div>
          </div>

          {/* ITEM SELECTION TABLE */}
          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-3">Select Items to Return</h3>
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold text-gray-700">Product Name</th>
                    <th className="px-4 py-3 text-center font-bold text-gray-700">Available Qty</th>
                    <th className="px-4 py-3 text-right font-bold text-gray-700">Unit Price</th>
                    <th className="px-4 py-3 text-center font-bold text-gray-700">Return Qty</th>
                    <th className="px-4 py-3 text-right font-bold text-gray-700">Return Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {selectedItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-800">{item.name}</td>
                      <td className="px-4 py-3 text-center font-bold text-gray-700">{item.qty}</td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        ₹{(item.sellingPrice || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min="0"
                          max={item.qty}
                          value={item.returnedQty}
                          onChange={(e) => handleReturnedQtyChange(idx, e.target.value)}
                          className="w-20 px-2 py-1 border rounded text-center font-bold"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-teal-600">
                        ₹{((item.sellingPrice || 0) * (item.returnedQty || 0)).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* RETURN REASON */}
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">
              Reason for Return <span className="text-red-600">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Damaged goods, Wrong product, Quality issue..."
              rows="3"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* TOTALS DISPLAY */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg border">
              <p className="text-gray-600 text-xs uppercase font-bold">Subtotal</p>
              <p className="text-2xl font-black text-gray-800">₹{totals.subtotal.toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border">
              <p className="text-gray-600 text-xs uppercase font-bold">Tax</p>
              <p className="text-2xl font-black text-gray-800">₹{totals.totalTax.toLocaleString()}</p>
            </div>
            <div className="bg-teal-50 p-4 rounded-lg border-2 border-teal-500">
              <p className="text-teal-700 text-xs uppercase font-bold">Total Credit</p>
              <p className="text-2xl font-black text-teal-600">₹{totals.grandTotal.toLocaleString()}</p>
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateCreditNote}
              disabled={saving}
              className="px-6 py-2 bg-teal-600 text-white rounded-lg font-bold hover:bg-teal-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Creating..." : "Create Credit Note"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
