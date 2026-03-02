import { useEffect, useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { API_BASE } from "../../api";

const InventoryAddVoucherTypeModal = ({ isOpen, onClose, onSave, branchId, editingItem }) => {
  const [voucherName, setVoucherName] = useState("");
  const [orderType, setOrderType] = useState("PO"); 
  const [prefix, setPrefix] = useState("");
  const [loading, setLoading] = useState(false);
  const [existingVouchers, setExistingVouchers] = useState([]);
  const [fetchingVouchers, setFetchingVouchers] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (editingItem) {
      setVoucherName(editingItem.name || "");
      setOrderType(editingItem.orderType || "PO");
      setPrefix(editingItem.prefix || "");
    } else {
      setVoucherName("");
      setOrderType("PO");
      setPrefix("");
    }
  }, [editingItem]);

  // Fetch existing vouchers for this branch when modal opens
  useEffect(() => {
    if (isOpen && branchId) {
      setFetchingVouchers(true);
      fetch(`${API_BASE}/voucher-types?branchId=${branchId}`)
        .then(res => res.json())
        .then(data => {
          setExistingVouchers(Array.isArray(data) ? data : data.data || []);
        })
        .catch(err => console.error("Failed to fetch vouchers:", err))
        .finally(() => setFetchingVouchers(false));
    }
  }, [isOpen, branchId]);

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

    if (!voucherName || !orderType || loading || !branchId) {
      toast.info("Please fill all fields and ensure branch is selected", toastConfig);
      return;
    }

    // When editing, skip duplicate check for same record, but check others
    if (!editingItem) {
      const voucherExists = existingVouchers.some(
        v => v.name.toLowerCase() === voucherName.trim().toLowerCase() && v.orderType === orderType
      );

      if (voucherExists) {
        toast.error(
          `"${voucherName}" voucher for ${orderType} already exists in this branch!`,
          toastConfig
        );
        return;
      }
    }

    try {
      setLoading(true);

      // If editing, use PUT; otherwise use POST
      const method = editingItem ? "PUT" : "POST";
      const url = editingItem 
        ? `${API_BASE}/voucher-types/${editingItem._id}` 
        : `${API_BASE}/voucher-types`;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: voucherName,
          orderType,
          prefix: prefix || "",
          branchId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          toast.error(
            "Voucher already exists for this order type in this branch",
            toastConfig
          );
        } else {
          toast.error(
            data?.message || `Failed to ${editingItem ? "update" : "save"} voucher type`,
            toastConfig
          );
        }
        return;
      }

      toast.success(`Voucher type ${editingItem ? "updated" : "created"} successfully`, toastConfig);

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

            {/* Existing Vouchers Section */}
            {existingVouchers.length > 0 && (
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <p className="text-xs font-semibold text-blue-900 mb-2">
                  ✅ Existing Vouchers for This Branch:
                </p>
                <div className="space-y-1">
                  {existingVouchers.map((v) => (
                    <div key={v._id} className="text-xs text-blue-800 flex justify-between">
                      <span className="font-medium">{v.name.toUpperCase()}</span>
                      <span className="text-blue-600">({v.orderType})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
