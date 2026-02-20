import { useEffect, useState } from "react";
import { FaPlus, FaTimes, FaTrash } from "react-icons/fa";
import { API_BASE } from "../../api";

const DebitNoteModal = ({ isOpen, onClose, onSave, purchaseOrders = [] }) => {
  const [formData, setFormData] = useState({
    originalPurchaseOrderId: "",
    vendor: { name: "" },
    items: [],
    reason: "",
  });
  const [selectedPO, setSelectedPO] = useState(null);
  const [currentItem, setCurrentItem] = useState({
    productId: "",
    name: "",
    returnedQty: 0,
    purchasePrice: 0,
  });

  // Log POs when modal opens
  useEffect(() => {
    if (isOpen) {
      console.log("📦 Debit Note Modal - POs received:", purchaseOrders);
      console.log("📦 POs count:", purchaseOrders.length);
    }
  }, [isOpen, purchaseOrders]);

  const handlePOSelect = (poId) => {
    const po = purchaseOrders.find((p) => p._id === poId);
    console.log("📦 Selected PO:", po);
    if (po) {
      setSelectedPO(po);
      setFormData({
        ...formData,
        originalPurchaseOrderId: poId,
        vendor: { name: po.vendor || "" },
        items: [],
      });
    }
  };

  const handleAddItem = () => {
    if (!currentItem.productId || !currentItem.returnedQty) {
      alert("Please fill all item fields");
      return;
    }

    setFormData({
      ...formData,
      items: [...formData.items, { ...currentItem }],
    });
    setCurrentItem({ productId: "", name: "", returnedQty: 0, purchasePrice: 0 });
  };

  const handleRemoveItem = (index) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.originalPurchaseOrderId || formData.items.length === 0) {
      alert("Please select a PO and add items");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/debit-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (data.success) {
        alert("Debit Note created successfully");
        onSave(data.data);
        setFormData({
          originalPurchaseOrderId: "",
          vendor: { name: "" },
          items: [],
          reason: "",
        });
        onClose();
      } else {
        alert(data.message || "Failed to create debit note");
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="bg-blue-500 text-white p-4 sticky top-0 flex justify-between items-center">
          <h3 className="text-xl font-bold">Create Debit Note</h3>
          <button onClick={onClose} className="hover:bg-blue-600 p-2 rounded">
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Select PO */}
          <div>
            <label className="text-sm font-bold text-gray-600 block mb-2">
              Select Purchase Order
            </label>
            <select
              value={formData.originalPurchaseOrderId}
              onChange={(e) => handlePOSelect(e.target.value)}
              className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select PO --</option>
              {purchaseOrders.map((po) => (
                <option key={po._id} value={po._id}>
                  {po.invoiceId} - {po.vendor} ({po.items?.length || 0} items)
                </option>
              ))}
            </select>
          </div>

          {/* Vendor Info */}
          {selectedPO && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">
                <strong>Vendor:</strong> {formData.vendor.name}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Warehouse:</strong> {selectedPO.warehouse || "N/A"}
              </p>
            </div>
          )}

          {/* Return Reason */}
          <div>
            <label className="text-sm font-bold text-gray-600 block mb-2">
              Reason for Return
            </label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Enter reason for return (quality issues, excess stock, etc.)"
              rows={3}
              className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Add Items */}
          {selectedPO && (
            <div className="border-t pt-4">
              <h4 className="font-semibold text-gray-700 mb-3">Add Return Items</h4>

              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-sm font-bold text-gray-600 block mb-1">
                    Product (from PO)
                  </label>
                  <select
                    value={currentItem.productId}
                    onChange={(e) => {
                      const itemIndex = selectedPO.items.findIndex(
                        (i) => i.productId === e.target.value
                      );
                      if (itemIndex !== -1) {
                        const poItem = selectedPO.items[itemIndex];
                        setCurrentItem({
                          ...currentItem,
                          productId: e.target.value,
                          name: poItem.name,
                          purchasePrice: poItem.purchasePrice,
                        });
                      }
                    }}
                    className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Select Product --</option>
                    {selectedPO.items?.map((item) => (
                      <option key={item.productId} value={item.productId}>
                        {item.name} (Available: {item.qty} qty)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-bold text-gray-600 block mb-1">
                    Quantity to Return
                  </label>
                  <input
                    type="number"
                    value={currentItem.returnedQty}
                    onChange={(e) =>
                      setCurrentItem({
                        ...currentItem,
                        returnedQty: parseInt(e.target.value) || 0,
                      })
                    }
                    placeholder="Enter quantity"
                    className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 transition font-semibold flex items-center justify-center gap-2"
                >
                  <FaPlus size={14} /> Add Item
                </button>
              </div>

              {/* Items List */}
              {formData.items.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <h5 className="font-semibold text-gray-700 mb-2">Items to Return:</h5>
                  <div className="space-y-2">
                    {formData.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center bg-white p-2 rounded border"
                      >
                        <div>
                          <p className="font-semibold text-gray-900">{item.name}</p>
                          <p className="text-sm text-gray-600">Qty: {item.returnedQty}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="bg-red-500 text-white p-2 rounded hover:bg-red-600 transition"
                        >
                          <FaTrash size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </form>

        <div className="border-t p-4 flex gap-3 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="flex-1 p-2 border rounded-lg hover:bg-gray-100 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-bold"
          >
            Create Debit Note
          </button>
        </div>
      </div>
    </div>
  );
};

export default DebitNoteModal;
