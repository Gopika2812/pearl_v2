import { useState } from "react";
import { FaPlus, FaTimes, FaTrash } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";

const ExtraExpensesOrderModal = ({ isOpen, onClose, onSuccess }) => {
  const { currentBranch } = useBranch();
  const [expenses, setExpenses] = useState([]);
  const [expenseName, setExpenseName] = useState("");
  const [expensePrice, setExpensePrice] = useState("");
  const [totalAmount, setTotalAmount] = useState(0);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAddExpense = () => {
    if (!expenseName.trim()) {
      return toast.error("Enter expense name");
    }

    if (!expensePrice || parseFloat(expensePrice) <= 0) {
      return toast.error("Enter a valid price");
    }

    const newExpense = {
      id: Date.now(),
      name: expenseName.trim(),
      price: parseFloat(expensePrice),
    };

    setExpenses([...expenses, newExpense]);
    setExpenseName("");
    setExpensePrice("");
    toast.success("Expense added!");

    // Update total
    const newTotal = expenses.reduce((sum, e) => sum + e.price, 0) + newExpense.price;
    setTotalAmount(newTotal);
  };

  const handleRemoveExpense = (id) => {
    const filtered = expenses.filter((e) => e.id !== id);
    setExpenses(filtered);

    // Update total
    const newTotal = filtered.reduce((sum, e) => sum + e.price, 0);
    setTotalAmount(newTotal);
    toast.info("Expense removed");
  };

  const handleSave = async () => {
    if (expenses.length === 0) {
      return toast.error("Add at least one expense");
    }

    setSaving(true);

    try {
      const payload = {
        branchId: currentBranch?._id || currentBranch?.id,
        expenses: expenses.map((e) => ({
          name: e.name,
          price: e.price,
        })),
        totalAmount,
        description: description || "Extra Expenses Order",
        date: new Date(),
        status: "recorded",
      };

      const response = await fetchWithAuth(`${API_BASE}/expenses`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Extra expenses recorded successfully!");
        setExpenses([]);
        setTotalAmount(0);
        setDescription("");
        setExpenseName("");
        setExpensePrice("");
        onSuccess?.();
        onClose();
      } else {
        toast.error(data.message || "Failed to save expenses");
      }
    } catch (err) {
      console.error("Error saving expenses:", err);
      toast.error("Error saving expenses");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col">
        {/* HEADER - Fixed */}
        <div className="bg-gradient-to-r from-[#257f87] to-[#319bab] text-white p-6 flex justify-between items-center rounded-t-2xl flex-shrink-0">
          <h2 className="text-2xl font-bold">💰 Extra Expenses Order</h2>
          <button
            onClick={onClose}
            className="text-2xl hover:opacity-75 transition"
          >
            <FaTimes />
          </button>
        </div>

        {/* SCROLLABLE CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* INFO BOX */}
          <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4">
            <p className="text-sm text-gray-700">
              <span className="font-bold text-blue-700">Example:</span> If someone orders ice cream and needs a freezer as well, add freezer as an extra expense here.
            </p>
          </div>

          {/* ADD EXPENSE FORM */}
          <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
            <h3 className="font-bold text-gray-800 uppercase text-sm">Add Expense</h3>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-2 uppercase">
                Expense Name
              </label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#319bab] outline-none text-sm bg-white"
                value={expenseName}
                onChange={(e) => setExpenseName(e.target.value)}
              >
                <option value="Transport">Transport</option>
                <option value="Discount">Discount</option>
                <option value="Offloading">Offloading</option>
                <option value="Unloading">Unloading</option>
                <option value="Freezer">Freezer</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-2 uppercase">
                Price (₹)
              </label>
              <input
                type="number"
                value={expensePrice}
                onChange={(e) => setExpensePrice(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#319bab] outline-none text-sm"
                onKeyPress={(e) => e.key === "Enter" && handleAddExpense()}
              />
            </div>

            <button
              onClick={handleAddExpense}
              className="w-full bg-green-600 text-white py-2 rounded-lg font-bold hover:bg-green-700 transition flex items-center justify-center gap-2"
            >
              <FaPlus /> Add Expense
            </button>
          </div>

          {/* DESCRIPTION */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-2 uppercase">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add notes about these expenses..."
              rows="3"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#319bab] outline-none text-sm resize-none"
            />
          </div>

          {/* EXPENSES LIST */}
          {expenses.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-100 px-4 py-3">
                <h4 className="font-bold text-[#319bab] uppercase text-xs">
                  Added Expenses ({expenses.length})
                </h4>
              </div>
              <div className="divide-y">
                {expenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                  >
                    <div>
                      <p className="font-semibold text-gray-800">{expense.name}</p>
                      <p className="text-xs text-gray-500">₹{expense.price.toFixed(2)}</p>
                    </div>
                    <button
                      onClick={() => handleRemoveExpense(expense.id)}
                      className="text-red-500 hover:text-red-700 transition text-lg"
                      title="Remove"
                    >
                      <FaTrash />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TOTAL AMOUNT */}
          {expenses.length > 0 && (
            <div className="bg-gradient-to-r from-[#319bab]/10 to-[#257f87]/10 border-2 border-[#319bab] rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-800 uppercase text-sm">
                  Total Amount
                </span>
                <span className="text-3xl font-black text-[#319bab]">
                  ₹{totalAmount.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ACTION BUTTONS - Fixed at bottom */}
        <div className="grid grid-cols-2 gap-3 border-t p-6 bg-white rounded-b-2xl flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full border-2 border-gray-300 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-50 transition"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || expenses.length === 0}
            className="w-full bg-[#319bab] text-white py-3 rounded-lg font-bold hover:bg-[#257f87] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save Expenses"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExtraExpensesOrderModal;
