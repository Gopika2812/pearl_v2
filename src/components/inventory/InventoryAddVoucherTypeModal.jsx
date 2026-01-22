import { useState } from "react";

const InventoryAddVoucherTypeModal = ({ isOpen, onClose, onSave }) => {
  const [voucherName, setVoucherName] = useState("");
  const [prefix, setPrefix] = useState("");

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    if (!voucherName || !prefix) return;

    onSave({
      id: Date.now(),
      name: voucherName,
      prefix: prefix.toUpperCase(),
      counter: "001",
    });
    
    // Reset and Close
    setVoucherName("");
    setPrefix("");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-primary p-4 text-white">
          <h3 className="text-xl font-bold font-cursive">Create New Voucher Type</h3>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Voucher Name</label>
            <input
              type="text"
              required
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none capitalize"
              placeholder="e.g. Zone-1 Purchase"
              value={voucherName}
              onChange={(e) => setVoucherName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Prefix</label>
            <input
              type="text"
              required
              maxLength="5"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none uppercase"
              placeholder="e.g. PUR"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
            />
          </div>

          {/* Info Box */}
          <div className="bg-gray-50 p-3 rounded-lg border border-dashed border-gray-300">
            <p className="text-xs text-gray-500">
              <span className="font-bold text-primary">Note:</span> Suffix (25-26) and Counter (001) are automatically managed for new vouchers.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-primary text-white px-4 py-2 rounded-lg hover:bg-opacity-90 transition font-semibold"
            >
              Save Voucher
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InventoryAddVoucherTypeModal;