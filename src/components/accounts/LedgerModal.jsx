import React, { useState, useEffect } from "react";
import { FaPlus, FaTimes, FaSave, FaFolderPlus, FaBook } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE } from "../../api";

const LedgerModal = ({ isOpen, onClose, branchId, onLedgerCreated }) => {
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState([]);
  const [showNewGroupForm, setShowNewGroupForm] = useState(false);

  // Main Ledger Form State
  const [formData, setFormData] = useState({
    name: "",
    groupId: "",
    gst: 0,
    gstin: "",
    hsn: "",
    openingDebit: 0,
    openingCredit: 0,
    notes: "",
  });

  // Inline Group Form State
  const [newGroupData, setNewGroupData] = useState({
    name: "",
    nature: "Expense",
    description: "",
  });

  useEffect(() => {
    if (isOpen && branchId) {
      fetchGroups();
    }
  }, [isOpen, branchId]);

  const fetchGroups = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/ledgers/groups?branchId=${branchId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await response.json();
      setGroups(data);

    } catch (err) {
      console.error("Error fetching groups:", err);
      toast.error("Failed to load ledger groups");
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleGroupChange = (e) => {
    const { name, value } = e.target;
    setNewGroupData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupData.name || !newGroupData.nature) {
      return toast.warn("Group Name and Nature are required");
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/ledgers/groups`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ ...newGroupData, branchId }),
      });
      const data = await response.json();


      if (response.ok) {
        toast.success(`Group "${data.name}" created!`);
        setGroups((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
        setFormData((prev) => ({ ...prev, groupId: data._id }));
        setShowNewGroupForm(false);
        setNewGroupData({ name: "", nature: "Expense", description: "" });
      } else {
        toast.error(data.message || "Failed to create group");
      }
    } catch (err) {
      toast.error("Network error creating group");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.groupId) {
      return toast.warn("Ledger Name and Group are required");
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/ledgers`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ ...formData, branchId }),
      });
      const data = await response.json();


      if (response.ok) {
        toast.success(`Ledger "${data.name}" created successfully!`);
        onLedgerCreated(data);
        onClose();
        setFormData({
          name: "",
          groupId: "",
          gst: 0,
          gstin: "",
          hsn: "",
          openingDebit: 0,
          openingCredit: 0,
          notes: "",
        });
      } else {
        toast.error(data.message || "Failed to create ledger");
      }
    } catch (err) {
      toast.error("Network error creating ledger");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#319bab] outline-none text-sm transition-all";
  const labelClass = "block text-[10px] font-bold text-gray-500 uppercase mb-1 tracking-wider";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        {/* HEADER */}
        <div className="bg-[#319bab] p-6 text-white flex justify-between items-center bg-gradient-to-r from-[#319bab] to-[#257f87]">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl">
              <FaBook size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">Create New Ledger</h2>
              <p className="text-xs text-white/70 font-medium">Add a manual ledger account to your books</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all">
            <FaTimes size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 max-h-[80vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* LEDGER NAME */}
            <div className="md:col-span-2">
              <label className={labelClass}>Ledger Account Name *</label>
              <input
                type="text"
                name="name"
                required
                className={inputClass}
                placeholder="e.g. Salary Account, A5 Paper, Transport"
                value={formData.name}
                onChange={handleChange}
              />
            </div>

            {/* LEDGER GROUP */}
            <div className="md:col-span-2">
              <label className={labelClass}>Ledger Group *</label>
              <div className="flex gap-2">
                <select
                  name="groupId"
                  required
                  className={inputClass}
                  value={formData.groupId}
                  onChange={handleChange}
                >
                  <option value="">Select a Group</option>
                  {groups.map((g) => (
                    <option key={g._id} value={g._id}>
                      {g.name} ({g.nature})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowNewGroupForm(!showNewGroupForm)}
                  className={`p-2 rounded-lg transition-all flex items-center justify-center min-w-[42px] ${
                    showNewGroupForm ? "bg-red-100 text-red-600" : "bg-[#319bab] text-white hover:bg-[#257f87]"
                  }`}
                  title="Add New Group"
                >
                  {showNewGroupForm ? <FaTimes /> : <FaPlus />}
                </button>
              </div>
            </div>

            {/* QUICK ADD GROUP FORM (INLINE) */}
            {showNewGroupForm && (
              <div className="md:col-span-2 bg-gray-50 p-6 rounded-2xl border-2 border-dashed border-[#319bab]/30 animate-in slide-in-from-top duration-300">
                <h3 className="text-xs font-black text-[#319bab] uppercase mb-4 flex items-center gap-2">
                   <FaFolderPlus /> Instant Group Creation
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Group Name</label>
                    <input
                      type="text"
                      className={inputClass}
                      placeholder="e.g. Marketing Expenses"
                      value={newGroupData.name}
                      onChange={(e) => setNewGroupData({ ...newGroupData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Nature</label>
                    <select
                      className={inputClass}
                      value={newGroupData.nature}
                      onChange={(e) => setNewGroupData({ ...newGroupData, nature: e.target.value })}
                    >
                      <option value="Expense">Expense</option>
                      <option value="Income">Income</option>
                      <option value="Asset">Asset</option>
                      <option value="Liability">Liability</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleCreateGroup}
                      className="w-full bg-[#319bab] text-white font-black py-2 rounded-lg text-[10px] uppercase tracking-widest hover:bg-[#257f87] transition-all"
                    >
                      {loading ? "Creating..." : "Save New Group"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* GST FIELDS */}
            <div>
              <label className={labelClass}>GST Percentage (%)</label>
              <input
                type="number"
                name="gst"
                className={inputClass}
                placeholder="0"
                value={formData.gst}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className={labelClass}>HSN Code</label>
              <input
                type="text"
                name="hsn"
                className={inputClass}
                placeholder="HSN Code"
                value={formData.hsn}
                onChange={handleChange}
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>GSTIN</label>
              <input
                type="text"
                name="gstin"
                className={inputClass}
                placeholder="GSTIN if applicable"
                value={formData.gstin}
                onChange={handleChange}
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Payment Method Association (Optional)</label>
              <select
                name="paymentMethod"
                className={inputClass}
                value={formData.paymentMethod}
                onChange={handleChange}
              >
                <option value="">None / Not a Payment Ledger</option>
                <option value="CASH">CASH</option>
                <option value="BANK_TRANSFER">BANK TRANSFER</option>
                <option value="UPI">UPI / G-PAY / PHONEPE</option>
                <option value="CHEQUE">CHEQUE / DD</option>
                <option value="CREDIT_CARD">CREDIT CARD</option>
                <option value="DEBIT_CARD">DEBIT CARD</option>
                <option value="NEFT_RTGS">NEFT / RTGS / IMPS</option>
                <option value="POS">POS TERMINAL</option>
                <option value="PAYTM">PAYTM WALLET</option>
              </select>
            </div>

            {/* OPENING BALANCES */}
            <div>
              <label className={labelClass}>Opening Balance (Debit / Dr)</label>
              <input
                type="number"
                name="openingDebit"
                className={inputClass}
                placeholder="0.00"
                value={formData.openingDebit}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className={labelClass}>Opening Balance (Credit / Cr)</label>
              <input
                type="number"
                name="openingCredit"
                className={inputClass}
                placeholder="0.00"
                value={formData.openingCredit}
                onChange={handleChange}
              />
            </div>

            {/* NOTES */}
            <div className="md:col-span-2">
              <label className={labelClass}>Notes / Narration</label>
              <textarea
                name="notes"
                rows="2"
                className={inputClass + " resize-none"}
                placeholder="Additional details..."
                value={formData.notes}
                onChange={handleChange}
              ></textarea>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100 flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-200 text-gray-500 font-black rounded-2xl hover:bg-gray-50 transition-all uppercase text-xs tracking-widest"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-[#319bab] text-white font-black rounded-2xl shadow-xl shadow-[#319bab]/20 hover:bg-[#257f87] transition-all flex items-center justify-center gap-2 uppercase text-xs tracking-widest"
            >
              <FaSave /> {loading ? "Saving..." : "Create Ledger"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LedgerModal;
