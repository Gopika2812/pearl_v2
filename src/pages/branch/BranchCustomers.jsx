import { useEffect, useState } from "react";
import { FaList, FaSpinner, FaThLarge } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE } from "../../api";
import { useBranch } from "../../context/BranchContext";
import CustomerLedgerModal from "../../components/branch/CustomerLedgerModal";

const BranchCustomers = () => {
  const { branch, branchLoaded } = useBranch();
  const branchId = branch?._id;

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("card"); // "card" or "table"
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [salesOrders, setSalesOrders] = useState([]);
  const [customerPayments, setCustomerPayments] = useState([]);
  const [selectedLedgerCustomer, setSelectedLedgerCustomer] = useState(null);

  useEffect(() => {
    console.log("BranchCustomers mounted");
    console.log("branchLoaded:", branchLoaded);
    console.log("branch:", branch);
    console.log("branchId:", branchId);
    
    if (branchLoaded && branchId) {
      fetchCustomers(1);
      fetchSalesOrders();
      fetchCustomerPayments();
    }
  }, [branchLoaded, branchId]);

  const fetchSalesOrders = async () => {
    try {
      const url = `${API_BASE}/sales-orders`;
      const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        const result = await response.json();
        const orders = result.data || result || [];
        setSalesOrders(orders);
      }
    } catch (error) {
      console.error("Error fetching sales orders:", error);
    }
  };

  const fetchCustomerPayments = async () => {
    try {
      const url = `${API_BASE}/receipts`;
      const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        const result = await response.json();
        const payments = result.data || result || [];
        setCustomerPayments(payments);
      }
    } catch (error) {
      console.error("Error fetching customer payments:", error);
    }
  };

  const fetchCustomers = async (page = 1) => {
    try {
      setLoading(true);
      const url = `${API_BASE}/customers?branchId=${branchId}&page=${page}&limit=100&search=${encodeURIComponent(
        searchTerm
      )}`;
      console.log("Fetching customers from:", url);
      console.log("Branch ID:", branchId);
      
      const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      const result = await response.json();
      console.log("Customers Response:", result);

      if (!response.ok) {
        throw new Error(result.message || "Failed to fetch customers");
      }

      let customersData = result.data || [];

      // Backend already returns perfectly calculated debit and credit per customer. 
      // No need to manually add historical sales orders.

      setCustomers(customersData);
      setPagination(result.pagination || {});
      setCurrentPage(page);
      
      if (!customersData || customersData.length === 0) {
        toast.info("No customers found for this branch");
      }
    } catch (error) {
      console.error("Error fetching customers:", error);
      toast.error(`Failed to fetch customers: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  useEffect(() => {
    if (branchLoaded && branchId && searchTerm !== undefined) {
      const timer = setTimeout(() => {
        fetchCustomers(1);
      }, 500); // Debounce search

      return () => clearTimeout(timer);
    }
  }, [searchTerm, branchId, branchLoaded]);

  // Customer debit is already provided natively by the backend API.
  // There is no need for local array re-calculation.

  // Global Totals calculation
  const baseGlobalCredit = pagination?.totalGlobalCredit || 0;
  const baseGlobalDebit = pagination?.totalGlobalDebit || 0;

  const totalCredit = baseGlobalCredit;
  const totalDebit = baseGlobalDebit;

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
          <h1 className="text-3xl md:text-4xl font-bold mb-1">Customers (Debtors)</h1>
          <p className="text-blue-100 text-sm md:text-base">Manage customer accounts and track receivables</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition p-4 md:p-5 border-t-4 border-blue-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs md:text-sm font-semibold uppercase">Total Customers</p>
                <p className="text-3xl md:text-4xl font-bold text-blue-600 mt-1">
                  {pagination.total || customers.length}
                </p>
              </div>
              <div className="text-4xl md:text-5xl text-blue-200">👥</div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition p-4 md:p-5 border-t-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs md:text-sm font-semibold uppercase">Total Debit</p>
                <p className="text-2xl md:text-3xl font-bold text-red-500 mt-1">
                  ₹{totalDebit.toFixed(2)}
                </p>
              </div>
              <div className="text-4xl md:text-5xl text-red-200">💰</div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition p-4 md:p-5 border-t-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs md:text-sm font-semibold uppercase">Total Credit</p>
                <p className="text-2xl md:text-3xl font-bold text-green-600 mt-1">
                  ₹{totalCredit.toFixed(2)}
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
                placeholder="🔍 Search by name, email, GSTIN, or phone..."
                value={searchTerm}
                onChange={handleSearch}
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

      {/* Content */}
      {loading ? (
        <div className="flex justify-center items-center py-12 md:py-16">
          <FaSpinner className="animate-spin text-3xl md:text-4xl text-blue-600" />
        </div>
      ) : customers.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 md:p-12 text-center -mx-4 md:mx-0 md:rounded-lg">
          <p className="text-gray-500 text-base md:text-lg">No customers found</p>
        </div>
      ) : viewMode === "card" ? (
        /* CARD VIEW */
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {customers.map((customer) => (
              <div
                key={customer._id}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition p-4 md:p-5 border-t-4 border-blue-600"
              >
                {/* Name */}
                <h3 className="text-base md:text-lg font-bold text-gray-800 mb-3 truncate">
                  {customer.name}
                </h3>

                {/* Details */}
                <div className="space-y-2 mb-4 text-xs md:text-sm">
                  {customer.gstin && (
                    <p className="text-gray-600">
                      <span className="font-semibold text-gray-800">GSTIN:</span>{" "}
                      <span className="text-gray-700">{customer.gstin}</span>
                    </p>
                  )}
                  {customer.email && (
                    <p className="text-gray-600">
                      <span className="font-semibold text-gray-800">
                        Email:
                      </span>{" "}
                      <span className="text-gray-700">{customer.email}</span>
                    </p>
                  )}
                  {customer.whatsapp && (
                    <p className="text-gray-600">
                      <span className="font-semibold text-gray-800">
                        WhatsApp:
                      </span>{" "}
                      <span className="text-gray-700">{customer.whatsapp}</span>
                    </p>
                  )}
                  {customer.address && (
                    <p className="text-gray-600">
                      <span className="font-semibold text-gray-800">
                        Address:
                      </span>{" "}
                      <span className="text-gray-700">{customer.address}</span>
                    </p>
                  )}
                  {customer.state && (
                    <p className="text-gray-600">
                      <span className="font-semibold text-gray-800">State:</span>{" "}
                      <span className="text-gray-700">{customer.state}</span>
                    </p>
                  )}
                </div>

                {/* Divider */}
                <hr className="my-3 border-gray-200" />

                {/* Debit & Credit */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-red-50 rounded-lg p-3 text-center border border-red-200">
                    <p className="text-xs text-red-700 font-bold uppercase">Debit</p>
                    <p className="text-sm md:text-base font-bold text-red-600 mt-1">
                      ₹{(customer.debit || 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
                    <p className="text-xs text-green-700 font-bold uppercase">
                      Credit
                    </p>
                    <p className="text-sm md:text-base font-bold text-green-600 mt-1">
                      ₹{(customer.credit || 0).toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="mt-2">
                  <button
                    onClick={() => setSelectedLedgerCustomer(customer)}
                    className="w-full py-2 bg-blue-50 text-blue-600 font-semibold rounded-lg hover:bg-blue-600 hover:text-white transition-colors border border-blue-200 hover:border-blue-600 text-sm flex items-center justify-center gap-2"
                  >
                    <FaList size={14} /> View Ledger
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => fetchCustomers(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:bg-gray-300 transition font-semibold"
              >
                ◀ Previous
              </button>
              <span className="text-gray-700 font-bold text-lg">
                Page {currentPage} of {pagination.pages}
              </span>
              <button
                onClick={() => fetchCustomers(currentPage + 1)}
                disabled={currentPage === pagination.pages}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:bg-gray-300 transition font-semibold"
              >
                Next ▶
              </button>
            </div>
          )}
        </div>
      ) : (
        /* TABLE VIEW */
        <div>
          <div className="bg-white rounded-lg shadow-md overflow-x-auto -mx-4 md:mx-0 md:rounded-lg">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                <tr>
                  <th className="px-3 md:px-5 py-2 md:py-3 text-left text-xs md:text-sm font-bold">
                    Customer Name
                  </th>
                  <th className="px-3 md:px-5 py-2 md:py-3 text-left text-xs md:text-sm font-bold">
                    GSTIN
                  </th>
                  <th className="px-3 md:px-5 py-2 md:py-3 text-left text-xs md:text-sm font-bold">
                    Email
                  </th>
                  <th className="px-3 md:px-5 py-2 md:py-3 text-left text-xs md:text-sm font-bold">
                    WhatsApp
                  </th>
                  <th className="px-3 md:px-5 py-2 md:py-3 text-left text-xs md:text-sm font-bold">
                    Address
                  </th>
                  <th className="px-3 md:px-5 py-2 md:py-3 text-left text-xs md:text-sm font-bold">
                    State
                  </th>
                  <th className="px-3 md:px-5 py-2 md:py-3 text-left text-xs md:text-sm font-bold">
                    Country
                  </th>
                  <th className="px-3 md:px-5 py-2 md:py-3 text-right text-xs md:text-sm font-bold">
                    Debit
                  </th>
                  <th className="px-3 md:px-5 py-2 md:py-3 text-right text-xs md:text-sm font-bold">
                    Credit
                  </th>
                  <th className="px-3 md:px-5 py-2 md:py-3 text-center text-xs md:text-sm font-bold">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer, index) => (
                  <tr
                    key={customer._id}
                    className={`${
                      index % 2 === 0 ? "bg-white" : "bg-blue-50"
                    } border-b border-gray-200 hover:bg-blue-100/50 transition`}
                  >
                    <td className="px-3 md:px-5 py-2 md:py-3 text-xs md:text-sm font-semibold text-gray-800">
                      {customer.name}
                    </td>
                    <td className="px-3 md:px-5 py-2 md:py-3 text-xs md:text-sm text-gray-700">
                      {customer.gstin || "-"}
                    </td>
                    <td className="px-3 md:px-5 py-2 md:py-3 text-xs md:text-sm text-gray-700">
                      {customer.email || "-"}
                    </td>
                    <td className="px-3 md:px-5 py-2 md:py-3 text-xs md:text-sm text-gray-700">
                      {customer.whatsapp || "-"}
                    </td>
                    <td className="px-3 md:px-5 py-2 md:py-3 text-xs md:text-sm text-gray-700">
                      {customer.address || "-"}
                    </td>
                    <td className="px-3 md:px-5 py-2 md:py-3 text-xs md:text-sm text-gray-700">
                      {customer.state || "-"}
                    </td>
                    <td className="px-3 md:px-5 py-2 md:py-3 text-xs md:text-sm text-gray-700\">
                      {customer.country || "-"}
                    </td>
                    <td className="px-3 md:px-5 py-2 md:py-3 text-xs md:text-sm text-right font-bold text-red-600\">
                      ₹{(customer.debit || 0).toFixed(2)}
                    </td>
                    <td className="px-3 md:px-5 py-2 md:py-3 text-xs md:text-sm text-right font-bold text-green-600">
                      ₹{(customer.credit || 0).toFixed(2)}
                    </td>
                    <td className="px-3 md:px-5 py-2 md:py-3 text-center">
                      <button
                        onClick={() => setSelectedLedgerCustomer(customer)}
                        className="px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-600 hover:text-white rounded-md text-xs font-bold transition-colors"
                      >
                        Ledger
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => fetchCustomers(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:bg-gray-300 transition font-semibold"
              >
                ◀ Previous
              </button>
              <span className="text-gray-700 font-bold text-lg">
                Page {currentPage} of {pagination.pages}
              </span>
              <button
                onClick={() => fetchCustomers(currentPage + 1)}
                disabled={currentPage === pagination.pages}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:bg-gray-300 transition font-semibold"
              >
                Next ▶
              </button>
            </div>
          )}
        </div>
      )}
        </div>

      {/* LEDGER MODAL */}
      <CustomerLedgerModal
        isOpen={!!selectedLedgerCustomer}
        onClose={() => setSelectedLedgerCustomer(null)}
        customer={selectedLedgerCustomer}
        salesOrders={salesOrders}
        customerPayments={customerPayments}
      />
    </div>
  );
};

export default BranchCustomers;
