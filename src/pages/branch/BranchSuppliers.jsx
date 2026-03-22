import { useEffect, useState } from "react";
import { FaList, FaSpinner, FaThLarge } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE } from "../../api";
import { useBranch } from "../../context/BranchContext";
import VendorLedgerModal from "../../components/branch/VendorLedgerModal";

const BranchSuppliers = () => {
  const { branch, branchLoaded } = useBranch();
  const branchId = branch?._id;

  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("card"); // "card" or "table"
  const [searchTerm, setSearchTerm] = useState("");
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [selectedLedgerSupplier, setSelectedLedgerSupplier] = useState(null);

  useEffect(() => {
    if (branchLoaded && branchId) {
      fetchSuppliers();
    }
  }, [branchLoaded, branchId]);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      
      // Fetch all vendors
      const vendorUrl = `${API_BASE}/vendors?branchId=${branchId}`;
      const vendorResponse = await fetch(vendorUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!vendorResponse.ok) {
        throw new Error("Failed to fetch suppliers");
      }

      let vendorData = await vendorResponse.json();
      let suppliers = vendorData.data || [];

      // Fetch purchase orders and payments for credit calculation
      // NOTE: Fetching ALL POs, then filtering by branchId in the app
      const poUrl = `${API_BASE}/purchase-orders`;
      const poResponse = await fetch(poUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      const paymentUrl = `${API_BASE}/payments`;
      const paymentResponse = await fetch(paymentUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      let purchaseOrders = [];
      let payments = [];

      if (poResponse.ok) {
        const poResult = await poResponse.json();
        purchaseOrders = poResult.data || poResult || [];
        setPurchaseOrders(purchaseOrders);
        console.log(`✅ Fetched ${purchaseOrders.length} Purchase Orders`);
      } else {
        console.warn("Failed to fetch POs, status:", poResponse.status);
      }

      if (paymentResponse.ok) {
        const paymentResult = await paymentResponse.json();
        payments = paymentResult.data || paymentResult || [];
        setPayments(payments);
        console.log(`✅ Fetched ${payments.length} Payments`);
      } else {
        console.warn("Failed to fetch Payments, status:", paymentResponse.status);
      }

      // Calculate credit for each supplier based on unpaid/partially paid POs
      suppliers = suppliers.map((supplier) => {
        const existingCredit = supplier.credit || 0; // Get existing credit from database
        let outstandingFromPOs = 0; // Calculate outstanding from current POs
        let totalDebit = 0;

        // Normalize branchId for comparison (handle both string and ObjectId formats)
        const normalizedBranchId = typeof branchId === 'string' ? branchId : branchId?.toString();

        // Find POs for this supplier
        const supplierPOs = purchaseOrders.filter(
          (po) => {
            const poBranchId = typeof po.branchId === 'string' ? po.branchId : po.branchId?.toString();
            return (
              po.vendor === supplier.name && 
              poBranchId === normalizedBranchId &&
              po.status === "INVOICED"
            );
          }
        );
        
        console.log(`Supplier: ${supplier.name}, Total POs matched: ${supplierPOs.length}`);

        supplierPOs.forEach((po) => {
          if (po.status !== "INVOICED") return; // Only consider INVOICED POs
          const poAmount = po.grandTotal || 0;
          // Find payments for this PO
          const poPayments = payments.filter(
            (payment) => {
              const rawId = payment.purchaseOrder?.poId;
              const paymentPoId = rawId?._id ? rawId._id.toString() : rawId?.toString();
              const poId = po._id ? po._id.toString() : null;
              return paymentPoId === poId && payment.status === "completed";
            }
          );
          const totalPaidForPO = poPayments.reduce(
            (sum, payment) => sum + (payment.amount || 0),
            0
          );
          // Outstanding amount = PO total - paid amount
          const outstanding = poAmount - totalPaidForPO;
          if (outstanding > 0) {
            outstandingFromPOs += outstanding;
          }
        });

        // Debit is the sum of completed payments (money received from supplier if any)
        totalDebit = supplier.debit || 0;

        // Total credit = Existing credit from DB + Outstanding from current POs
        const totalCredit = existingCredit + outstandingFromPOs;

        console.log(
          `✅ ${supplier.name}: Credit=₹${totalCredit} (Existing: ₹${existingCredit}, Outstanding POs: ₹${outstandingFromPOs})`
        );

        return {
          ...supplier,
          credit: totalCredit,
          debit: totalDebit,
        };
      });

      setSuppliers(suppliers);
      if (suppliers.length === 0) {
        toast.info("No suppliers found for this branch");
      }
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      toast.error(`Failed to fetch suppliers: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredSuppliers = searchTerm
    ? suppliers.filter((supplier) =>
        supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplier.gstin?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplier.email?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : suppliers;

  // Helper function to get outstanding PO count for a supplier
  const getOutstandingPOCount = (supplierName) => {
    const normalizedBranchId = typeof branchId === 'string' ? branchId : branchId?.toString();

    const supplierPOs = purchaseOrders.filter(
      (po) => {
        const poBranchId = typeof po.branchId === 'string' ? po.branchId : po.branchId?.toString();
        return (
          po.vendor === supplierName &&
          poBranchId === normalizedBranchId &&
          po.status !== "CANCELLED"
        );
      }
    );

    let outstandingCount = 0;
    supplierPOs.forEach((po) => {
      const poAmount = po.grandTotal || 0;
      const poPayments = payments.filter(
        (payment) => {
          const rawId = payment.purchaseOrder?.poId;
          const paymentPoId = rawId?._id ? rawId._id.toString() : rawId?.toString();
          const poId = po._id?.toString() || po._id;
          return paymentPoId === poId && payment.status === "completed";
        }
      );
      const totalPaidForPO = poPayments.reduce(
        (sum, payment) => sum + (payment.amount || 0),
        0
      );
      const outstanding = poAmount - totalPaidForPO;
      if (outstanding > 0) {
        outstandingCount++;
      }
    });

    return outstandingCount;
  };

  const totalCredit = filteredSuppliers.reduce(
    (sum, supplier) => sum + (supplier.credit || 0),
    0
  );
  const totalDebit = filteredSuppliers.reduce(
    (sum, supplier) => sum + (supplier.debit || 0),
    0
  );

  if (!branchLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <FaSpinner className="animate-spin text-2xl text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 md:pl-20 pt-20 md:pt-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-800 text-white py-6 px-4 md:px-6 shadow-lg">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-1">Suppliers (Creditors)</h1>
          <p className="text-blue-100 text-sm md:text-base">Manage supplier accounts and track outstanding balances</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* Information Banner */}
        <div className="bg-blue-50 border border-blue-300 rounded-lg p-4 md:p-5">
          <p className="text-xs md:text-sm text-blue-800">
            <span className="font-semibold">💡 Credit Calculation:</span> Total Credit = Existing Credit from Database + Outstanding from Current POs. Outstanding POs are calculated as: (PO Amount - Paid Amount). Fully paid POs are excluded.
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition p-4 md:p-5 border-t-4 border-blue-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs md:text-sm font-semibold uppercase">Total Suppliers</p>
                <p className="text-3xl md:text-4xl font-bold text-blue-600 mt-1">
                  {filteredSuppliers.length}
                </p>
              </div>
              <div className="text-4xl md:text-5xl text-blue-200">👥</div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition p-4 md:p-5 border-t-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs md:text-sm font-semibold uppercase">Total Credit</p>
                <p className="text-2xl md:text-3xl font-bold text-red-500 mt-1">
                  ₹{totalCredit.toFixed(2)}
                </p>
              </div>
              <div className="text-4xl md:text-5xl text-red-200">💳</div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition p-4 md:p-5 border-t-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs md:text-sm font-semibold uppercase">Total Debit</p>
                <p className="text-2xl md:text-3xl font-bold text-green-600 mt-1">
                  ₹{totalDebit.toFixed(2)}
                </p>
              </div>
              <div className="text-4xl md:text-5xl text-green-200">✓</div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-md p-4 md:p-5 space-y-3 md:space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Search */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="🔍 Search by name, GSTIN, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>

            {/* View Toggle */}
            <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode("card")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition font-medium ${
                  viewMode === "card"
                    ? "bg-white text-blue-600 shadow-md"
                    : "text-gray-600 hover:text-blue-600"
                }`}
              >
                <FaThLarge size={16} /> Card
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition font-medium ${
                  viewMode === "table"
                    ? "bg-white text-blue-600 shadow-md"
                    : "text-gray-600 hover:text-blue-600"
                }`}
              >
                <FaList size={16} /> Table
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center items-center py-12 md:py-16">
          <FaSpinner className="animate-spin text-3xl md:text-4xl text-blue-600" />
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 md:p-12 text-center -mx-4 md:mx-0 md:rounded-lg">
          <p className="text-gray-500 text-base md:text-lg">No suppliers found</p>
        </div>
      ) : viewMode === "card" ? (
        /* CARD VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {filteredSuppliers.map((supplier) => (
            <div
              key={supplier._id}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition p-4 md:p-5 border-t-4 border-blue-600"
            >
              {/* Name */}
              <h3 className="text-base md:text-lg font-bold text-gray-800 mb-3 truncate">
                {supplier.name}
              </h3>

              {/* Details */}
              <div className="space-y-2 mb-4 text-xs md:text-sm">
                {supplier.gstin && (
                  <p className="text-gray-600">
                    <span className="font-semibold text-gray-800">GSTIN:</span>{" "}
                    <span className="text-gray-700">{supplier.gstin}</span>
                  </p>
                )}
                {supplier.email && (
                  <p className="text-gray-600">
                    <span className="font-semibold text-gray-800">Email:</span>{" "}
                    <span className="text-gray-700">{supplier.email}</span>
                  </p>
                )}
                {supplier.phone && (
                  <p className="text-gray-600">
                    <span className="font-semibold text-gray-800">Phone:</span>{" "}
                    <span className="text-gray-700">{supplier.phone}</span>
                  </p>
                )}
                {supplier.address && (
                  <p className="text-gray-600">
                    <span className="font-semibold text-gray-800">
                      Address:
                    </span>{" "}
                    <span className="text-gray-700">{supplier.address}</span>
                  </p>
                )}
                {supplier.stateName && (
                  <p className="text-gray-600">
                    <span className="font-semibold text-gray-800">State:</span>{" "}
                    <span className="text-gray-700">{supplier.stateName}</span>
                  </p>
                )}
              </div>

              {/* Divider */}
              <hr className="my-3 border-gray-200" />

              {/* Credit & Debit */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-red-50 rounded-lg p-3 text-center border border-red-200">
                  <p className="text-xs text-red-700 font-bold uppercase">Credit Pending</p>
                  <p className="text-sm md:text-base font-bold text-red-600 mt-1">
                    ₹{(supplier.credit || 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    {getOutstandingPOCount(supplier.name)} PO{getOutstandingPOCount(supplier.name) !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
                  <p className="text-xs text-green-700 font-bold uppercase">Debit</p>
                  <p className="text-sm md:text-base font-bold text-green-600 mt-1">
                    ₹{(supplier.debit || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-center">
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase ${
                    supplier.isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {supplier.isActive ? "✓ Active" : "Inactive"}
                </span>
              </div>

              {/* View Ledger Button */}
              <div className="mt-4 pt-3 border-t border-gray-100 flex justify-center">
                <button
                  onClick={() => setSelectedLedgerSupplier(supplier)}
                  className="w-full py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold rounded-lg transition-colors border border-teal-200 text-sm flex items-center justify-center gap-2"
                >
                  <span className="text-base">📅</span> View Ledger
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white rounded-lg shadow-md overflow-x-auto -mx-4 md:mx-0 md:rounded-lg">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <tr>
                <th className="px-3 md:px-5 py-2 md:py-3 text-left text-xs md:text-sm font-bold">
                  Supplier Name
                </th>
                <th className="px-3 md:px-5 py-2 md:py-3 text-left text-xs md:text-sm font-bold">
                  GSTIN
                </th>
                <th className="px-3 md:px-5 py-2 md:py-3 text-left text-xs md:text-sm font-bold">
                  Email
                </th>
                <th className="px-3 md:px-5 py-2 md:py-3 text-left text-xs md:text-sm font-bold">
                  Phone
                </th>
                <th className="px-3 md:px-5 py-2 md:py-3 text-left text-xs md:text-sm font-bold">
                  Address
                </th>
                <th className="px-3 md:px-5 py-2 md:py-3 text-left text-xs md:text-sm font-bold">
                  State
                </th>
                <th className="px-3 md:px-5 py-2 md:py-3 text-center text-xs md:text-sm font-bold">
                  Outstanding POs
                </th>
                <th className="px-3 md:px-5 py-2 md:py-3 text-right text-xs md:text-sm font-bold">
                  Credit
                </th>
                <th className="px-3 md:px-5 py-2 md:py-3 text-right text-xs md:text-sm font-bold">
                  Debit
                </th>
                <th className="px-3 md:px-5 py-2 md:py-3 text-center text-xs md:text-sm font-bold">
                  Status
                </th>
                <th className="px-3 md:px-5 py-2 md:py-3 text-center text-xs md:text-sm font-bold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.map((supplier, index) => (
                <tr
                  key={supplier._id}
                  className={`${
                    index % 2 === 0 ? "bg-white" : "bg-blue-50"
                  } border-b border-gray-200 hover:bg-blue-100/50 transition`}
                >
                  <td className="px-3 md:px-5 py-2 md:py-3 text-xs md:text-sm font-semibold text-gray-800">
                    {supplier.name}
                  </td>
                  <td className="px-3 md:px-5 py-2 md:py-3 text-xs md:text-sm text-gray-700">
                    {supplier.gstin || "-"}
                  </td>
                  <td className="px-3 md:px-5 py-2 md:py-3 text-xs md:text-sm text-gray-700">
                    {supplier.email || "-"}
                  </td>
                  <td className="px-3 md:px-5 py-2 md:py-3 text-xs md:text-sm text-gray-700">
                    {supplier.phone || "-"}
                  </td>
                  <td className="px-3 md:px-5 py-2 md:py-3 text-xs md:text-sm text-gray-700">
                    {supplier.address || "-"}
                  </td>
                  <td className="px-3 md:px-5 py-2 md:py-3 text-xs md:text-sm text-gray-700">
                    {supplier.stateName || "-"}
                  </td>
                  <td className="px-3 md:px-5 py-2 md:py-3 text-xs md:text-sm text-center font-semibold text-orange-600">
                    {getOutstandingPOCount(supplier.name)}
                  </td>
                  <td className="px-3 md:px-5 py-2 md:py-3 text-xs md:text-sm text-right font-bold text-red-600">
                    ₹{(supplier.credit || 0).toFixed(2)}
                  </td>
                  <td className="px-3 md:px-5 py-2 md:py-3 text-xs md:text-sm text-right font-bold text-green-600">
                    ₹{(supplier.debit || 0).toFixed(2)}
                  </td>
                  <td className="px-3 md:px-5 py-2 md:py-3 text-center">
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-xs font-bold uppercase ${
                        supplier.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {supplier.isActive ? "✓ Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-3 md:px-5 py-2 md:py-3 text-center">
                    <button
                      onClick={() => setSelectedLedgerSupplier(supplier)}
                      className="bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 px-3 py-1 rounded-md text-xs font-bold transition-colors whitespace-nowrap shadow-sm"
                    >
                      Transactions
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* VENDOR LEDGER MODAL */}
      <VendorLedgerModal 
        isOpen={!!selectedLedgerSupplier}
        onClose={() => setSelectedLedgerSupplier(null)}
        supplier={selectedLedgerSupplier}
        purchaseOrders={purchaseOrders}
        payments={payments}
      />
    </div>
  );
};

export default BranchSuppliers;
