import { useEffect, useState } from "react";
import {
  FaArrowLeft, FaFileInvoiceDollar, FaSearch, FaSyncAlt,
  FaMoneyBillWave, FaUndoAlt, FaFilter, FaDownload, FaPlus
} from "react-icons/fa";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../../api";
import { useBranch } from "../../context/BranchContext";
import VendorCreditPaymentModal from "../../components/inventory/VendorCreditPaymentModal";
import SupplierDebitNoteModal from "../../components/inventory/SupplierDebitNoteModal";

export default function BranchSupplierTransactions() {
  const { currentBranch } = useBranch();
  const navigate = useNavigate();

  const [payments, setPayments] = useState([]);
  const [debitNotes, setDebitNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all"); // all | payments | debitnotes
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDnModal, setShowDnModal] = useState(false);

  const fetchAll = async () => {
    if (!currentBranch?._id) return;
    setLoading(true);
    try {
      const [payRes, dnRes] = await Promise.all([
        fetch(`${API_BASE}/payments?branchId=${currentBranch._id}&paymentType=vendor_payment`),
        fetch(`${API_BASE}/debit-notes?branchId=${currentBranch._id}`),
      ]);
      const payData = await payRes.json();
      const dnData = await dnRes.json();

      setPayments(payData.data || []);
      setDebitNotes(dnData.data || []);
    } catch (err) {
      toast.error("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [currentBranch]);

  const formatDate = (d) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  // Combine and filter
  const allRecords = [
    ...payments.map(p => ({
      type: "payment",
      id: p.paymentId,
      supplier: p.vendor?.name || "—",
      amount: p.amount,
      method: p.paymentMethod?.replace(/_/g, " ").toUpperCase(),
      reference: p.referenceNo || "—",
      note: p.description || "—",
      date: p.paymentDate || p.createdAt,
      raw: p,
    })),
    ...debitNotes.map(dn => ({
      type: "debitnote",
      id: dn.debitNoteId,
      supplier: dn.vendor?.name || "—",
      amount: dn.grandTotal,
      method: "—",
      reference: dn.originalInvoiceId || "—",
      note: dn.reason || "—",
      date: dn.createdAt,
      raw: dn,
    })),
  ]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .filter(r => {
      const q = search.toLowerCase();
      if (!q) return true;
      return (
        r.id?.toLowerCase().includes(q) ||
        r.supplier?.toLowerCase().includes(q) ||
        r.reference?.toLowerCase().includes(q)
      );
    })
    .filter(r => {
      if (activeTab === "payments") return r.type === "payment";
      if (activeTab === "debitnotes") return r.type === "debitnote";
      return true;
    });

  const totalPayments = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const totalReturns = debitNotes.reduce((s, dn) => s + (dn.grandTotal || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">

        {/* HEADER */}
        <div className="bg-gradient-to-r from-teal-700 to-teal-500 text-white rounded-2xl shadow-xl p-7 mb-7">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/branch/suppliers")}
                className="p-2 bg-white/15 hover:bg-white/25 rounded-xl transition"
              >
                <FaArrowLeft />
              </button>
              <div>
                <h1 className="text-3xl font-black tracking-tight">Supplier Transactions</h1>
                <p className="text-teal-100 text-sm mt-1">All payment and debit note records for your suppliers</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchAll}
                disabled={loading}
                className="p-2 bg-white/15 hover:bg-white/25 rounded-xl transition"
                title="Refresh"
              >
                <FaSyncAlt className={loading ? "animate-spin" : ""} />
              </button>
              <button
                onClick={() => setShowPaymentModal(true)}
                className="flex items-center gap-2 bg-white text-teal-700 px-4 py-2 rounded-xl font-bold hover:bg-teal-50 transition shadow-lg text-sm"
              >
                <FaMoneyBillWave /> Pay
              </button>
              <button
                onClick={() => setShowDnModal(true)}
                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl font-bold transition shadow-lg text-sm"
              >
                <FaUndoAlt /> Debit Note
              </button>
            </div>
          </div>
        </div>

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <FaMoneyBillWave className="text-emerald-600 text-lg" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Total Payments</p>
              <p className="text-2xl font-black text-gray-800">₹{totalPayments.toLocaleString()}</p>
              <p className="text-xs text-gray-400">{payments.length} records</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <FaUndoAlt className="text-red-500 text-lg" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Total Returns</p>
              <p className="text-2xl font-black text-gray-800">₹{totalReturns.toLocaleString()}</p>
              <p className="text-xs text-gray-400">{debitNotes.length} debit notes</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <FaFileInvoiceDollar className="text-blue-500 text-lg" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Total Records</p>
              <p className="text-2xl font-black text-gray-800">{payments.length + debitNotes.length}</p>
              <p className="text-xs text-gray-400">All combined</p>
            </div>
          </div>
        </div>

        {/* TABLE CARD */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* TABS + SEARCH */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 border-b border-gray-100">
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {[
                { key: "all", label: "All" },
                { key: "payments", label: "💳 Payments" },
                { key: "debitnotes", label: "↩️ Debit Notes" },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-bold transition ${
                    activeTab === tab.key
                      ? "bg-white text-teal-700 shadow-sm"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-72">
              <FaSearch className="absolute left-3 top-2.5 text-gray-400 text-sm" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by ID, supplier..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400 transition"
              />
            </div>
          </div>

          {/* TABLE */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-20 text-center text-gray-400">
                <FaSyncAlt className="animate-spin text-3xl mx-auto mb-3 text-teal-400" />
                <p>Loading transactions...</p>
              </div>
            ) : allRecords.length === 0 ? (
              <div className="py-20 text-center text-gray-400">
                <FaFileInvoiceDollar className="text-5xl mx-auto mb-4 text-gray-200" />
                <p className="text-lg font-bold">No transactions found</p>
                <p className="text-sm mt-1">Record a supplier payment or debit note to get started</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Transaction ID</th>
                    <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Type</th>
                    <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Supplier</th>
                    <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Date</th>
                    <th className="px-5 py-3.5 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Amount</th>
                    <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Method</th>
                    <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Reference</th>
                    <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {allRecords.map((rec, idx) => (
                    <tr key={rec.id || idx} className="hover:bg-gray-50/60 transition">
                      <td className="px-5 py-3.5">
                        <span className="font-mono font-bold text-teal-700 text-xs bg-teal-50 px-2 py-1 rounded">
                          {rec.id || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {rec.type === "payment" ? (
                          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full w-fit">
                            <FaMoneyBillWave /> Payment
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full w-fit">
                            <FaUndoAlt /> Debit Note
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-gray-800">{rec.supplier}</td>
                      <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">{formatDate(rec.date)}</td>
                      <td className="px-5 py-3.5 text-right font-black text-gray-800">
                        ₹{(rec.amount || 0).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5">
                        {rec.method !== "—" ? (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-bold">{rec.method}</span>
                        ) : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">{rec.reference}</td>
                      <td className="px-5 py-3.5 text-gray-400 text-xs max-w-[180px] truncate" title={rec.note}>{rec.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* PAYMENT MODAL */}
      <VendorCreditPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onPaymentSuccess={() => { setShowPaymentModal(false); fetchAll(); }}
      />

      {/* DEBIT NOTE MODAL */}
      <SupplierDebitNoteModal
        isOpen={showDnModal}
        onClose={() => setShowDnModal(false)}
        onSuccess={() => { setShowDnModal(false); fetchAll(); }}
      />
    </div>
  );
}
