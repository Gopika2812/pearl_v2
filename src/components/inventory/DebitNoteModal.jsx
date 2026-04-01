import { useEffect, useState } from "react";
import { FaFileAlt, FaTimes } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";

const DebitNoteModal = ({ po, isOpen, onClose, onDebitNoteSuccess }) => {
  const { currentBranch } = useBranch();
  const [selectedItems, setSelectedItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("");

  // Initialize selected items when PO is set
  useEffect(() => {
    if (isOpen && po) {
      // Initialize with empty returned quantities
      const items = (po.items || []).map((item) => ({
        ...item,
        returnedQty: 0,
      }));
      setSelectedItems(items);
      setReason("");
    }
  }, [isOpen, po]);

  const handleReturnedQtyChange = (index, value) => {
    const newItems = [...selectedItems];
    const maxQty = newItems[index].qty || 0;
    const returnedQty = Math.min(parseInt(value) || 0, maxQty);
    newItems[index].returnedQty = Math.max(0, returnedQty);
    setSelectedItems(newItems);
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let totalTax = 0;
    let totalReturned = 0;

    selectedItems.forEach((item) => {
      if (item.returnedQty > 0) {
        const itemTotal = item.returnedQty * (item.purchasePrice || 0);
        const itemTax = (itemTotal * (item.gst || 0)) / 100;
        subtotal += itemTotal;
        totalTax += itemTax;
        totalReturned += item.returnedQty;
      }
    });

    return {
      subtotal: Math.round(subtotal),
      totalTax: Math.round(totalTax),
      grandTotal: Math.round(subtotal + totalTax),
      totalReturned,
    };
  };

  const handleCreateDebitNote = async () => {
    // Validate at least one item is returned
    const itemsToReturn = selectedItems.filter((item) => item.returnedQty > 0);
    if (itemsToReturn.length === 0) {
      return toast.error("Please select at least one product to return!");
    }

    if (!reason.trim()) {
      return toast.error("Please provide a reason for the return!");
    }

    setSaving(true);

    try {
      const { subtotal, totalTax, grandTotal } = calculateTotals();

      // Prepare items with only returned items
      const itemsPayload = itemsToReturn.map((item) => ({
        productId: item.productId,
        name: item.name,
        returnedQty: item.returnedQty,
        purchasePrice: item.purchasePrice,
        total: item.returnedQty * item.purchasePrice,
      }));

      const response = await fetchWithAuth(`${API_BASE}/debit-notes`, {
        method: "POST",
        body: JSON.stringify({
          branchId: currentBranch?._id || currentBranch?.id,
          originalPurchaseOrderId: po._id,
          vendor: {
            name: po.vendor,
          },
          items: itemsPayload,
          subtotal,
          totalTax,
          grandTotal,
          reason,
          status: "confirmed",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Update vendor debit after successful debit note creation
        await updateVendorDebit(po.vendor, grandTotal, currentBranch?._id || currentBranch?.id);

        toast.success("Debit note created successfully!");
        onClose();
        onDebitNoteSuccess?.();
      } else {
        toast.error(data.message || "Failed to create debit note");
      }
    } catch (err) {
      console.error("Debit note creation error:", err);
      toast.error("Error creating debit note");
    } finally {
      setSaving(false);
    }
  };

  // Update vendor debit after debit note creation
  const updateVendorDebit = async (vendorName, debitAmount, branchId) => {
    try {
      // Fetch all vendors for the branch
      const vendorResponse = await fetchWithAuth(`${API_BASE}/vendors?branchId=${branchId}`);
      const vendorData = await vendorResponse.json();
      const vendors = vendorData.data || [];

      // Find the vendor by name
      const vendor = vendors.find((v) => v.name === vendorName);
      if (!vendor) {
        console.warn(`Vendor not found: ${vendorName}`);
        return;
      }

      // Calculate new debit (increase by debit note amount)
      const newDebit = (vendor.debit || 0) + debitAmount;
      // Calculate new credit (decrease by debit note amount)
      const newCredit = Math.max(0, (vendor.credit || 0) - debitAmount);

      // Update vendor's debit and credit in database
      const updateResponse = await fetchWithAuth(`${API_BASE}/vendors/${vendor._id}`, {
        method: "PUT",
        body: JSON.stringify({
          debit: newDebit,
          credit: newCredit,
          isActive: vendor.isActive,
        }),
      });

      if (updateResponse.ok) {
        console.log(
          `✅ Vendor updated: ${vendorName}`
        );
        console.log(
          `   Debit: ₹${vendor.debit || 0} → ₹${newDebit}`
        );
        console.log(
          `   Credit: ₹${vendor.credit || 0} → ₹${newCredit}`
        );
      } else {
        console.error("Failed to update vendor debit/credit");
      }
    } catch (err) {
      console.error("Error updating vendor debit:", err);
    }
  };

  const totals = calculateTotals();

  if (!isOpen || !po) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* HEADER */}
        <div className="sticky top-0 bg-gradient-to-r from-red-600 to-red-700 text-white p-6 flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FaFileAlt /> Debit Note for {po.invoiceId}
          </h2>
          <button
            onClick={onClose}
            className="text-2xl hover:opacity-75 transition"
          >
            <FaTimes />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* VENDOR & PO INFO */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold mb-1">Vendor</p>
                <p className="font-bold text-gray-800">{po.vendor}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold mb-1">Original PO</p>
                <p className="font-bold text-[#319bab]">{po.invoiceId}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold mb-1">Warehouse</p>
                <p className="font-bold text-gray-800">{po.warehouse}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold mb-1">PO Date</p>
                <p className="font-bold text-gray-800">
                  {new Date(po.date).toLocaleDateString("en-IN")}
                </p>
              </div>
            </div>
          </div>

          {/* RETURN ITEMS */}
          <div>
            <h3 className="font-bold text-[#319bab] mb-4 uppercase text-sm">Select Items to Return</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left">Product</th>
                    <th className="px-4 py-3 text-center">Available QTY</th>
                    <th className="px-4 py-3 text-center">Return QTY</th>
                    <th className="px-4 py-3 text-right">Price</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {selectedItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{item.name}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded font-bold">
                          {item.qty}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min="0"
                          max={item.qty}
                          value={item.returnedQty || 0}
                          onChange={(e) => handleReturnedQtyChange(idx, e.target.value)}
                          className="w-20 border border-gray-300 rounded px-2 py-1 text-center font-bold focus:ring-2 focus:ring-red-500 outline-none"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">₹{(item.purchasePrice || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-bold text-red-600">
                        ₹{((item.returnedQty || 0) * (item.purchasePrice || 0)).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* TOTALS */}
          <div className="grid grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase font-bold mb-1">Subtotal</p>
              <p className="text-2xl font-black text-gray-800">
                ₹{totals.subtotal.toLocaleString()}
              </p>
            </div>
            <div className="text-center border-l border-r border-gray-300">
              <p className="text-xs text-gray-500 uppercase font-bold mb-1">Total Tax</p>
              <p className="text-2xl font-black text-gray-800">
                ₹{totals.totalTax.toLocaleString()}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase font-bold mb-1">Grand Total</p>
              <p className="text-2xl font-black text-red-600">
                ₹{totals.grandTotal.toLocaleString()}
              </p>
            </div>
          </div>

          {/* REASON */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-2 uppercase">
              Reason for Return *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for returning these items (e.g., Damaged, Defective, Wrong quantity, etc.)"
              rows="3"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 outline-none text-sm resize-none"
            />
          </div>

          {/* ACTION BUTTONS */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t">
            <button
              onClick={onClose}
              className="w-full border-2 border-gray-300 text-gray-700 py-2 rounded-lg font-bold hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateDebitNote}
              disabled={saving || totals.totalReturned === 0}
              className="w-full bg-red-600 text-white py-2 rounded-lg font-bold hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <FaFileAlt />
              {saving ? "Creating..." : `Create Debit Note (₹${totals.grandTotal.toLocaleString()})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebitNoteModal;
