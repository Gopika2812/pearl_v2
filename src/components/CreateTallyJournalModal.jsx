import React, { useState, useEffect } from "react";
import { FaTimes, FaSave } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE } from "../api";
import { useBranch } from "../context/BranchContext";

const CreateTallyJournalModal = ({ isOpen, onClose, onRefresh }) => {
  const { currentBranch } = useBranch();
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState([]);
  const [formData, setFormData] = useState({
    group: "",
    journalName: "",
    address: "",
    state: "",
    registrationType: "",
    gstin: "",
    credit: 0,
    debit: 0,
  });

  useEffect(() => {
    if (isOpen) {
      fetchGroups();
      setFormData({
        group: "",
        journalName: "",
        address: "",
        state: "",
        registrationType: "",
        gstin: "",
        credit: 0,
        debit: 0,
      });
    }
  }, [isOpen]);

  const fetchGroups = async () => {
    try {
      const res = await fetch(`${API_BASE}/tally-journals/groups`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const data = await res.json();
      if (res.ok) setGroups(data);
    } catch (error) {
      console.error("Error fetching groups:", error);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.group || !formData.journalName) {
      toast.error("Group and Journal Name are required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/tally-journals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create journal");

      toast.success("Journal created successfully!");
      onRefresh();
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">Create Journal Entry</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <FaTimes size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Group / Parent <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="group"
                list="group-options"
                value={formData.group}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#319bab] outline-none transition"
                placeholder="e.g., Indirect Expenses"
                required
              />
              <datalist id="group-options">
                {groups.map((g) => (
                  <option key={g._id} value={g.name} />
                ))}
              </datalist>
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Journal Name (Ledger) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="journalName"
                value={formData.journalName}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#319bab] outline-none transition"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Credit Balance
              </label>
              <input
                type="number"
                name="credit"
                step="0.01"
                value={formData.credit}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#319bab] outline-none transition"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Debit Balance
              </label>
              <input
                type="number"
                name="debit"
                step="0.01"
                value={formData.debit}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#319bab] outline-none transition"
              />
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Address
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#319bab] outline-none transition"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                State
              </label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#319bab] outline-none transition"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                GST Registration Type
              </label>
              <select
                name="registrationType"
                value={formData.registrationType}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#319bab] outline-none transition"
              >
                <option value="">Select Type</option>
                <option value="Regular">Regular</option>
                <option value="Composition">Composition</option>
                <option value="Unregistered/Consumer">Unregistered/Consumer</option>
              </select>
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                GSTIN / UIN
              </label>
              <input
                type="text"
                name="gstin"
                value={formData.gstin}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#319bab] outline-none transition uppercase"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 rounded-lg font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2 rounded-lg font-semibold text-white bg-[#319bab] hover:bg-[#257f87] transition disabled:opacity-50"
              disabled={loading}
            >
              <FaSave />
              {loading ? "Saving..." : "Save Journal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTallyJournalModal;
