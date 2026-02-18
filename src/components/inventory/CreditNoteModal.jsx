import { useEffect, useMemo, useState } from "react";
import { FaX } from "react-icons/fa6";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { API_BASE } from "../../api";

export default function CreditNoteModal({ isOpen, onClose, salesOrder }) {
  const [selectedItems, setSelectedItems] = useState([]);
  const [reasonForReturn, setReasonForReturn] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [existingCreditNotes, setExistingCreditNotes] = useState([]);

  // Load existing credit notes when modal opens
  useEffect(() => {
    if (isOpen && salesOrder) {
      fetchExistingCreditNotes();
    }
  }, [isOpen, salesOrder]);

  const fetchExistingCreditNotes = async () => {
    try {
      const response = await fetch(`${API_BASE}/credit-notes/order/${salesOrder._id}`);
      const data = await response.json();
      if (data.success) {
        setExistingCreditNotes(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch credit notes:", error);
    }
  };

  const handleToggleItem = (itemId, qty) => {
    const exists = selectedItems.find(item => item._id === itemId);
    
    if (exists) {
      setSelectedItems(selectedItems.filter(item => item._id !== itemId));
    } else {
      setSelectedItems([
        ...selectedItems,
        {
          _id: itemId,
          qty: qty,
          maxQty: qty,
        }
      ]);
    }
  };

  const handleQuantityChange = (itemId, newQty) => {
    const originalItem = salesOrder?.items?.find(item => item._id.toString() === itemId);
    if (!originalItem) return;
    
    const maxQty = originalItem.qty;
    
    if (newQty > maxQty) {
      toast.error(
        `Cannot exceed original quantity (${maxQty})`
      );
      return;
    }

    if (newQty <= 0) {
      setSelectedItems(selectedItems.filter(item => item._id !== itemId));
      return;
    }

    setSelectedItems(
      selectedItems.map(item =>
        item._id === itemId ? { ...item, qty: newQty } : item
      )
    );
  };

  const calculatedReturnAmount = useMemo(() => {
    if (selectedItems.length === 0 || !salesOrder?.items) return 0;

    let total = 0;
    selectedItems.forEach(returnItem => {
      const originalItem = salesOrder.items.find(i => i._id.toString() === returnItem._id);
      if (originalItem) {
        const itemSubtotal = originalItem.sellingPrice * returnItem.qty;
        const itemDiscount = (itemSubtotal * originalItem.discountPercent) / 100;
        const itemTaxable = itemSubtotal - itemDiscount;
        const itemTax = (itemTaxable * originalItem.gst) / 100;
        total += itemTaxable + itemTax;
      }
    });
    return total;
  }, [selectedItems, salesOrder]);

  const handleCreateCreditNote = async () => {
    if (selectedItems.length === 0) {
      toast.error("Please select at least one item to return");
      return;
    }

    if (!reasonForReturn.trim()) {
      toast.error("Please provide a reason for return");
      return;
    }

    try {
      setIsCreating(true);
      const response = await fetch(`${API_BASE}/credit-notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          originalSalesOrderId: salesOrder._id,
          items: selectedItems,
          reasonForReturn,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Credit Note ${data.creditNoteId} created`);
        setSelectedItems([]);
        setReasonForReturn("");
        fetchExistingCreditNotes();
        // Optionally close modal after 2 seconds
        setTimeout(() => onClose(), 2000);
      } else {
        toast.error(data.message || "Failed to create credit note");
      }
    } catch (error) {
      toast.error("Failed to create credit note");
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen || !salesOrder) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-96 overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold">Add Credit Note (Return Items)</h2>
          <button
            onClick={onClose}
            className="hover:bg-white hover:bg-opacity-20 p-2 rounded"
          >
            <FaX />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Existing Credit Notes Summary */}
          {existingCreditNotes.length > 0 && (
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <p className="font-semibold text-blue-900 mb-2">
                Existing Credit Notes: {existingCreditNotes.length}
              </p>
              <div className="space-y-1">
                {existingCreditNotes.map(cn => (
                  <div key={cn._id} className="text-sm text-blue-800">
                    {cn.creditNoteId} - ₹{cn.grandTotal.toFixed(2)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Original Items Selection */}
          <div>
            <h3 className="font-semibold text-gray-800 mb-3">
              Select Items to Return:
            </h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {salesOrder?.items && salesOrder.items.length > 0 ? (
                salesOrder.items.map((item) => {
                  const isSelected = selectedItems.find(si => si._id === item._id.toString());
                  return (
                    <div
                      key={item._id}
                      className="flex items-center justify-between p-3 border rounded hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <input
                          type="checkbox"
                          checked={!!isSelected}
                        onChange={() => handleToggleItem(item._id.toString(), item.qty)}
                        className="mr-3 w-4 h-4 cursor-pointer"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm text-gray-700">{item.name}</p>
                      <p className="text-xs text-gray-500">
                        ₹{item.sellingPrice} x {item.qty}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max={item.qty}
                          value={selectedItems.find(si => si._id === item._id.toString()).qty}
                          onChange={(e) =>
                            handleQuantityChange(
                              item._id.toString(),
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="w-16 px-2 py-1 border rounded text-sm"
                        />
                        <span className="text-xs text-gray-600">of {item.qty}</span>
                      </div>
                    )}
                  </div>
                );
              })
              ) : (
                <p className="text-sm text-gray-500">No items available in this sales order</p>
              )}
            </div>
          </div>

          {/* Reason for Return */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Return:
            </label>
            <textarea
              value={reasonForReturn}
              onChange={(e) => setReasonForReturn(e.target.value)}
              placeholder="Enter reason for return..."
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              rows="2"
            />
          </div>

          {/* Return Amount Summary */}
          {selectedItems.length > 0 && (
            <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded">
              <p className="text-sm text-gray-600 mb-2">Total Return Amount:</p>
              <p className="text-2xl font-bold text-purple-600">
                ₹{calculatedReturnAmount.toFixed(2)}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-4">
            <button
              onClick={onClose}
              className="px-6 py-2 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition"
              disabled={isCreating}
            >
              Cancel
            </button>
            <button
              onClick={handleCreateCreditNote}
              disabled={selectedItems.length === 0 || !reasonForReturn.trim() || isCreating}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? "Creating..." : "Create Credit Note"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
