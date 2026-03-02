import { useEffect, useState } from "react";
import { API_BASE } from "../../api";
import FilterableSelect from "../FilterableSelect";

const InventoryAddCustomerModal = ({ isOpen, onClose, onSave, salesOwners = [], customerCategories = [], branchId, editingItem }) => {
  const [customer, setCustomer] = useState({
    name: "",
    whatsapp: "",
    email: "",
    address: "",
    district: "",
    state: "",
    pincode: "",
    gstin: "",
    closingBalance: 0,
    margin: 0,
    salesOwner: "",
    customerCategory: "",
    accountHolder: "",
    accountNumber: "",
    ifsc: "",
    branch: "",
    upi: "",
  });

  // Pre-fill form when editing
  useEffect(() => {
    if (editingItem) {
      setCustomer({
        ...customer,
        name: editingItem.name || "",
        whatsapp: editingItem.whatsapp || "",
        email: editingItem.email || "",
        address: editingItem.address || "",
        district: editingItem.district || "",
        state: editingItem.state || "",
        pincode: editingItem.pincode || "",
        gstin: editingItem.gstin || "",
        closingBalance: editingItem.closingBalance || 0,
        margin: editingItem.margin || 0,
        salesOwner: editingItem.salesOwner || "",
        customerCategory: editingItem.customerCategory || "",
        accountHolder: editingItem.accountHolder || "",
        accountNumber: editingItem.accountNumber || "",
        ifsc: editingItem.ifsc || "",
        branch: editingItem.branch || "",
        upi: editingItem.upi || "",
      });
    } else {
      setCustomer({
        name: "",
        whatsapp: "",
        email: "",
        address: "",
        district: "",
        state: "",
        pincode: "",
        gstin: "",
        closingBalance: 0,
        margin: 0,
        salesOwner: "",
        customerCategory: "",
        accountHolder: "",
        accountNumber: "",
        ifsc: "",
        branch: "",
        upi: "",
      });
    }
  }, [editingItem]);

  if (!isOpen) return null;
  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("branchId", branchId);

    try {
      const res = await fetch(`${API_BASE}/customers/bulk-upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Bulk upload failed");
      }

      alert(
        `Uploaded: ${data.insertedCount}\nSkipped: ${data.skippedCount}`
      );

      console.log("Customer bulk upload:", data);
      onClose();
    } catch (err) {
      console.error("Customer bulk upload error:", err);
      alert(err.message || "Bulk upload failed");
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Round numeric values
    const roundedCustomer = {
      ...customer,
      closingBalance: Math.round(Number(customer.closingBalance || 0)),
      margin: Math.round(Number(customer.margin || 0)),
    };
    
    await onSave(roundedCustomer);

    setCustomer({
      name: "",
      whatsapp: "",
      email: "",
      address: "",
      district: "",
      state: "",
      pincode: "",
      gstin: "",
      closingBalance: 0,
      margin: 0,
      salesOwner: "",
      customerCategory: "",
      accountHolder: "",
      accountNumber: "",
      ifsc: "",
      branch: "",
      upi: "",
    });

    onClose();
  };

  const labelClass = "text-sm font-bold text-gray-600 mb-1 block";
  const inputClass =
    "w-full p-2 border rounded-lg outline-primary focus:ring-1 focus:ring-primary";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">

        <div className="bg-primary p-4 text-white">
          <h3 className="text-xl font-bold">Register New Customer</h3>
        </div>

        <input
          type="file"
          accept=".xlsx,.xls"
          hidden
          id="customerBulkUpload"
          onChange={handleBulkUpload}
        />

        <button
          type="button"
          onClick={() =>
            document.getElementById("customerBulkUpload").click()
          }
          className="w-full bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition"
        >
          📤 Bulk Upload Customers (Excel)
        </button>



        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-5 max-h-[80vh] overflow-y-auto"
        >
          {/* BASIC DETAILS */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelClass}>Customer Name *</label>
              <input
                type="text"
                required
                className={inputClass}
                value={customer.name}
                onChange={(e) =>
                  setCustomer({ ...customer, name: e.target.value })
                }
              />
            </div>

            <div>
              <label className={labelClass}>WhatsApp *</label>
              <input
                type="tel"
                required
                className={inputClass}
                value={customer.whatsapp}
                onChange={(e) =>
                  setCustomer({ ...customer, whatsapp: e.target.value })
                }
              />
            </div>

            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                className={inputClass}
                value={customer.email}
                onChange={(e) =>
                  setCustomer({ ...customer, email: e.target.value })
                }
              />
            </div>

            <div className="col-span-2">
              <label className={labelClass}>Address</label>
              <textarea
                className={`${inputClass} h-20`}
                value={customer.address}
                onChange={(e) =>
                  setCustomer({ ...customer, address: e.target.value })
                }
              />
            </div>

            <div>
              <label className={labelClass}>District</label>
              <input
                type="text"
                className={inputClass}
                value={customer.district}
                onChange={(e) =>
                  setCustomer({ ...customer, district: e.target.value })
                }
              />
            </div>

            <div>
              <label className={labelClass}>State</label>
              <input
                type="text"
                className={inputClass}
                value={customer.state}
                onChange={(e) =>
                  setCustomer({ ...customer, state: e.target.value })
                }
              />
            </div>

            <div>
              <label className={labelClass}>Pincode</label>
              <input
                type="text"
                className={inputClass}
                value={customer.pincode}
                onChange={(e) =>
                  setCustomer({ ...customer, pincode: e.target.value })
                }
              />
            </div>

            <div className="col-span-2">
              <label className={labelClass}>GSTIN</label>
              <input
                type="text"
                className={inputClass}
                value={customer.gstin}
                onChange={(e) =>
                  setCustomer({ ...customer, gstin: e.target.value.toUpperCase() })
                }
                placeholder="E.g., 27AABCD1234H1Z0"
              />
            </div>

            <div>
              <label className={labelClass}>Sales Owner</label>
              <FilterableSelect
                options={salesOwners.map(owner => ({
                  _id: owner._id,
                  name: `${owner.name} (${owner.phone})`
                }))}
                value={customer.salesOwner}
                onChange={(value) =>
                  setCustomer({ ...customer, salesOwner: value })
                }
                placeholder="Select Sales Owner"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Customer Category</label>
              <FilterableSelect
                options={customerCategories}
                value={customer.customerCategory}
                onChange={(value) =>
                  setCustomer({ ...customer, customerCategory: value })
                }
                placeholder="Select Category"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Closing Balance</label>
              <input
                type="number"
                step="0.01"
                className={inputClass}
                value={customer.closingBalance}
                onChange={(e) =>
                  setCustomer({ ...customer, closingBalance: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            <div>
              <label className={labelClass}>Margin (% - Positive or Negative)</label>
              <input
                type="number"
                step="0.01"
                className={inputClass}
                value={customer.margin}
                onChange={(e) =>
                  setCustomer({ ...customer, margin: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
          </div>

          <hr />

          {/* BANK DETAILS */}
          <div className="space-y-4 bg-gray-50 p-4 rounded-xl border">
            <h4 className="text-primary font-bold text-sm">
              Bank Details
            </h4>

            <div>
              <label className={labelClass}>Account Holder *</label>
              <input
                type="text"
                required
                className={inputClass}
                value={customer.accountHolder}
                onChange={(e) =>
                  setCustomer({
                    ...customer,
                    accountHolder: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <label className={labelClass}>Account Number *</label>
              <input
                type="text"
                required
                className={inputClass}
                value={customer.accountNumber}
                onChange={(e) =>
                  setCustomer({
                    ...customer,
                    accountNumber: e.target.value,
                  })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>IFSC *</label>
                <input
                  type="text"
                  required
                  className={`${inputClass} uppercase`}
                  value={customer.ifsc}
                  onChange={(e) =>
                    setCustomer({ ...customer, ifsc: e.target.value })
                  }
                />
              </div>

              <div>
                <label className={labelClass}>Branch *</label>
                <input
                  type="text"
                  required
                  className={inputClass}
                  value={customer.branch}
                  onChange={(e) =>
                    setCustomer({ ...customer, branch: e.target.value })
                  }
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>UPI</label>
              <input
                type="text"
                className={inputClass}
                value={customer.upi}
                onChange={(e) =>
                  setCustomer({ ...customer, upi: e.target.value })
                }
              />
            </div>
          </div>

          {/* ACTIONS */}
          <div className="flex gap-3 pt-4 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 p-2 border rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 p-2 bg-primary text-white rounded-lg font-bold shadow-lg"
            >
              Save Customer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InventoryAddCustomerModal;
