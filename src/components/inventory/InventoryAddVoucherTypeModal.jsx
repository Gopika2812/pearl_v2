import { useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const InventoryAddVoucherTypeModal = ({ isOpen, onClose, onSave }) => {
  const [voucherName, setVoucherName] = useState("");
  const [orderType, setOrderType] = useState("PO"); // ✅ PO or SO
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const toastConfig = {
    position: "top-right",
    autoClose: 2500,
    hideProgressBar: true,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    theme: "colored",
    style: {
      background: "rgba(49, 155, 171, 0.85)",
      color: "#fff",
      backdropFilter: "blur(6px)",
      borderRadius: "12px",
      boxShadow: "0 8px 20px rgba(49,155,171,0.25)",
    },
  };

  const handleSave = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!voucherName || !orderType || loading) {
      toast.info("Please fill all fields", toastConfig);
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("http://localhost:5000/api/voucher-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: voucherName,
          orderType, // ✅ CRITICAL
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          toast.error(
            "Voucher already exists for this order type",
            toastConfig
          );
        } else {
          toast.error(
            data?.message || "Failed to save voucher type",
            toastConfig
          );
        }
        return;
      }

      toast.success("Voucher type created successfully", toastConfig);

      // ✅ update UI state only
      onSave(data);

      setVoucherName("");
      setOrderType("PO");
      onClose();
    } catch (err) {
      toast.error("Network error. Please try again.", toastConfig);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ToastContainer />

      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
        <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">

          {/* Header */}
          <div className="bg-[rgba(49,155,171,0.9)] p-4 text-white">
            <h3 className="text-xl font-bold font-cursive">
              Create New Voucher Type
            </h3>
          </div>

          {/* Form */}
          <form onSubmit={handleSave} className="p-6 space-y-4">

            {/* Voucher Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Voucher Name
              </label>
              <input
                type="text"
                required
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[rgba(49,155,171,0.35)] outline-none capitalize"
                placeholder="e.g. Zone-1"
                value={voucherName}
                onChange={(e) => setVoucherName(e.target.value)}
              />
            </div>

            {/* Order Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Voucher For
              </label>
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[rgba(49,155,171,0.35)] outline-none"
              >
                <option value="PO">Purchase Order (PO)</option>
                <option value="SO">Sales Order (SO)</option>
              </select>
            </div>

            {/* Info Box */}
            <div className="bg-[rgba(49,155,171,0.08)] p-3 rounded-lg border border-dashed border-[rgba(49,155,171,0.3)]">
              <p className="text-xs text-gray-600">
                <span className="font-bold text-[rgba(49,155,171,0.9)]">
                  Note:
                </span>{" "}
                Invoice will be auto-generated like{" "}
                <span className="font-semibold">
                  ZONE1{orderType}/001/25-26
                </span>
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-semibold"
                disabled={loading}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-[rgba(49,155,171,0.9)] text-white px-4 py-2 rounded-lg hover:bg-[rgba(49,155,171,0.75)] transition font-semibold"
              >
                {loading ? "Saving..." : "Save Voucher"}
              </button>
            </div>

          </form>
        </div>
      </div>
    </>
  );
};

export default InventoryAddVoucherTypeModal;
