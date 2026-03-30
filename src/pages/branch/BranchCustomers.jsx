import React, { useEffect, useState } from "react";
import { FaList, FaSpinner, FaThLarge, FaPlus, FaUpload, FaFileExport, FaChevronDown, FaChevronUp, FaWhatsapp, FaMapMarkerAlt, FaEnvelope, FaUserTie, FaTags } from "react-icons/fa";
import * as XLSX from 'xlsx';
import { toast } from "react-toastify";
import { API_BASE } from "../../api";
import { useBranch } from "../../context/BranchContext";
import { useInventory } from "../../context/InventoryContext";
import CustomerLedgerModal from "../../components/branch/CustomerLedgerModal";
import InventoryAddCustomerModal from "../../components/inventory/InventoryAddCustomerModal";


const BranchCustomers = () => {
  const { branch, branchLoaded, user } = useBranch();
  const branchId = branch?._id;

  // Permission helper
  const isFieldAllowed = (fieldId) => {
    if (!user) return false;
    if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") return true;
    const key = `customers_${fieldId}`;
    return user.fieldPermissions?.[key] !== false; // Default to true
  };

  const { 
    customerCategories, customerGroups, salesOwners, addData, updateData 
  } = useInventory();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("table"); // "table" or "card"
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [salesOrders, setSalesOrders] = useState([]);
  const [customerPayments, setCustomerPayments] = useState([]);
  const [selectedLedgerCustomer, setSelectedLedgerCustomer] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});


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

  const handleAddCustomer = async (data) => {
    try {
      if (data._id) {
        const { _id, ...updatePayload } = data;
        await updateData("customer", _id, updatePayload);
        toast.success("Customer updated successfully");
      } else {
        const dataWithBranch = { ...data, branchId };
        await addData("customer", dataWithBranch);
        toast.success("Customer added successfully");
      }
      fetchCustomers(currentPage);
    } catch (error) {
      console.error("Error saving customer:", error);
      toast.error("Failed to save customer");
    }
  };


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

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const getSortedCustomers = (data) => {
    return [...data].sort((a, b) => {
      const { key, direction } = sortConfig;
      
      if (key === "name") {
        const valA = a.name.toLowerCase();
        const valB = b.name.toLowerCase();
        if (valA < valB) return direction === "asc" ? -1 : 1;
        if (valA > valB) return direction === "asc" ? 1 : -1;
        return 0;
      }
      
      if (key === "margin" || key === "debit" || key === "credit") {
        const valA = a[key] || 0;
        const valB = b[key] || 0;
        return direction === "asc" ? valA - valB : valB - valA;
      }
      
      return 0;
    });
  };
 
  const toggleRow = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const sortedCustomers = getSortedCustomers(customers);

  const handleExportExcel = async () => {
    try {
      setLoading(true);
      // Fetch all customers (up to 10000) for export
      const url = `${API_BASE}/customers?branchId=${branchId}&limit=10000`;
      const response = await fetch(url);
      const result = await response.json();

      if (!response.ok) throw new Error(result.message || "Failed to fetch all customers");

      const allCustomers = result.data || [];

      const exportData = allCustomers.map(c => ({
        "Customer Name": c.name || "-",
        "Email": c.email || "-",
        "WhatsApp": c.whatsapp || "-",
        "GSTIN": c.gstin || "-",
        "Address": c.address || "-",
        "District": c.district || "-",
        "State": c.state || "-",
        "Pincode": c.pincode || "-",
        "Registration Type": c.registrationType || "-",
        "Margin (%)": c.margin || 0,
        "Debit (₹)": c.debit || 0,
        "Credit (₹)": c.credit || 0,
        "Credit Limit (₹)": c.creditLimit || 0,
        "Sales Owner": c.salesOwner?.name || "-",
        "Category": c.customerCategory?.name || "-",
        "Group": c.customerGroup?.name || "-"
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Customers");

      // Auto-width adjustment
      const wscols = [
        { wch: 30 }, // Customer Name
        { wch: 25 }, // Email
        { wch: 15 }, // WhatsApp
        { wch: 20 }, // GSTIN
        { wch: 40 }, // Address
        { wch: 15 }, // District
        { wch: 15 }, // State
        { wch: 10 }, // Pincode
        { wch: 18 }, // Registration Type
        { wch: 12 }, // Margin
        { wch: 12 }, // Debit
        { wch: 12 }, // Credit
        { wch: 15 }, // Credit Limit
        { wch: 20 }, // Sales Owner
        { wch: 20 }, // Category
        { wch: 20 }  // Group
      ];
      worksheet['!cols'] = wscols;

      XLSX.writeFile(workbook, `Customers_Report_${new Date().toLocaleDateString()}.xlsx`);
      toast.success("All customer data exported successfully!");
    } catch (error) {
      console.error("Export error:", error);
      toast.error(`Failed to export Excel: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 md:pl-20 pt-20 md:pt-6">
      {/* Header & Controls */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6 mx-4 md:mx-6 mt-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-2.5 rounded-xl">
              <FaList className="text-xl text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight">
                Customers (Debtors)
              </h1>
              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">
                Manage your client base and balances
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 text-sm shadow-md active:scale-95"
            >
              <FaPlus /> Add Customer
            </button>

            <button
              onClick={handleExportExcel}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 text-sm shadow-md active:scale-95"
            >
              <FaFileExport /> Export Excel
            </button>
            
            <div className="flex bg-gray-100 p-1 rounded-xl items-center">
              <button
                onClick={() => setViewMode("table")}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === "table"
                    ? "bg-white text-primary shadow-sm"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <FaList size={18} />
              </button>
              <button
                onClick={() => setViewMode("card")}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === "card"
                    ? "bg-white text-primary shadow-sm"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <FaThLarge size={18} />
              </button>
            </div>
          </div>
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
          {isFieldAllowed("debit") && (
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
          )}
          {isFieldAllowed("credit") && (
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
          )}
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
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition font-medium ${
                  viewMode === "table"
                    ? "bg-white text-blue-600 shadow-md"
                    : "text-gray-600 hover:text-blue-600"
                }`}
              >
                <FaList size={16} /> Table
              </button>
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
                  {isFieldAllowed("gstin") && customer.gstin && (
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
                  {isFieldAllowed("margin") && (
                    <p className="text-gray-600">
                      <span className="font-semibold text-gray-800">Margin:</span>{" "}
                      <span className={`font-bold ${customer.margin < 0 ? 'text-red-500' : 'text-green-600'}`}>
                        {customer.margin || 0}%
                      </span>
                    </p>
                  )}
                </div>

                {/* Divider */}
                <hr className="my-3 border-gray-200" />

                {/* Debit & Credit */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {isFieldAllowed("debit") && (
                    <div className="bg-red-50 rounded-lg p-3 text-center border border-red-200">
                      <p className="text-xs text-red-700 font-bold uppercase">Debit</p>
                      <p className="text-sm md:text-base font-bold text-red-600 mt-1">
                        ₹{(customer.debit || 0).toFixed(2)}
                      </p>
                    </div>
                  )}
                  {isFieldAllowed("credit") && (
                    <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
                      <p className="text-xs text-green-700 font-bold uppercase">
                        Credit
                      </p>
                      <p className="text-sm md:text-base font-bold text-green-600 mt-1">
                        ₹{(customer.credit || 0).toFixed(2)}
                      </p>
                    </div>
                  )}
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
                  <th className="w-10"></th>
                  <th className="px-3 md:px-5 py-2 md:py-3 text-left text-xs md:text-sm font-bold cursor-pointer hover:bg-blue-800 transition" onClick={() => handleSort("name")}>
                    Customer Name {sortConfig.key === "name" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "⇅"}
                  </th>
                  {isFieldAllowed("gstin") && (
                    <th className="px-3 md:px-5 py-2 md:py-3 text-left text-xs md:text-sm font-bold">
                      GSTIN
                    </th>
                  )}
                  {isFieldAllowed("margin") && (
                    <th className="px-3 md:px-5 py-2 md:py-3 text-center text-xs md:text-sm font-bold cursor-pointer hover:bg-blue-800 transition" onClick={() => handleSort("margin")}>
                      Margin (%) {sortConfig.key === "margin" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "⇅"}
                    </th>
                  )}
                  {isFieldAllowed("debit") && (
                    <th className="px-3 md:px-5 py-2 md:py-3 text-right text-xs md:text-sm font-bold cursor-pointer hover:bg-blue-800 transition" onClick={() => handleSort("debit")}>
                      Debit {sortConfig.key === "debit" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "⇅"}
                    </th>
                  )}
                  {isFieldAllowed("credit") && (
                    <th className="px-3 md:px-5 py-2 md:py-3 text-right text-xs md:text-sm font-bold cursor-pointer hover:bg-blue-800 transition" onClick={() => handleSort("credit")}>
                      Credit {sortConfig.key === "credit" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "⇅"}
                    </th>
                  )}
                  <th className="px-3 md:px-5 py-2 md:py-3 text-center text-xs md:text-sm font-bold">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedCustomers.map((customer, index) => {
                  const isExpanded = !!expandedRows[customer._id];
                  return (
                    <React.Fragment key={customer._id}>
                      <tr
                        className={`${
                          index % 2 === 0 ? "bg-white" : "bg-blue-50"
                        } border-b border-gray-200 hover:bg-blue-100/50 transition cursor-pointer`}
                        onClick={() => toggleRow(customer._id)}
                      >
                        <td className="px-4 py-3 text-center text-gray-400">
                           {isExpanded ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
                        </td>
                        <td className="px-3 md:px-5 py-2 md:py-3 text-xs md:text-sm font-semibold text-gray-800">
                          {customer.name}
                        </td>
                        {isFieldAllowed("gstin") && (
                          <td className="px-3 md:px-5 py-2 md:py-3 text-xs md:text-sm text-gray-700">
                            {customer.gstin || "-"}
                          </td>
                        )}
                        {isFieldAllowed("margin") && (
                          <td className={`px-3 md:px-5 py-2 md:py-3 text-xs md:text-sm text-center font-bold ${customer.margin < 0 ? 'text-red-500' : 'text-green-600'}`}>
                            {customer.margin || 0}%
                          </td>
                        )}
                        {isFieldAllowed("debit") && (
                          <td className="px-3 md:px-5 py-2 md:py-3 text-xs md:text-sm text-right font-bold text-red-600">
                            ₹{(customer.debit || 0).toFixed(2)}
                          </td>
                        )}
                        {isFieldAllowed("credit") && (
                          <td className="px-3 md:px-5 py-2 md:py-3 text-xs md:text-sm text-right font-bold text-green-600">
                            ₹{(customer.credit || 0).toFixed(2)}
                          </td>
                        )}
                        <td className="px-3 md:px-5 py-2 md:py-3 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLedgerCustomer(customer);
                            }}
                            className="px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-600 hover:text-white rounded-md text-xs font-bold transition-colors shadow-sm"
                          >
                            Ledger
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <td colSpan={7} className="px-8 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fadeIn">
                               {/* Contact and Social section */}
                               <div className="space-y-1">
                                 <p className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Contact & Social</p>
                                 <div className="flex items-center gap-2 text-xs text-gray-600 mt-2">
                                    <FaWhatsapp className="text-green-500 text-[10px]" />
                                    <span>{customer.whatsapp || "No WhatsApp provided"}</span>
                                 </div>
                                 <div className="flex items-center gap-2 text-xs text-gray-600">
                                    <FaEnvelope className="text-secondary text-[10px]" />
                                    <span>{customer.email || "No email provided"}</span>
                                 </div>
                               </div>
                               
                               {/* Location Section */}
                               <div className="space-y-1">
                                 <p className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Location & Address</p>
                                 <div className="flex items-start gap-2 text-xs text-gray-600 mt-2">
                                    <FaMapMarkerAlt className="text-secondary text-[10px] mt-0.5" />
                                    <span>
                                      {customer.address ? `${customer.address}, ${customer.district || ""}, ${customer.state || ""}, ${customer.country || ""} - ${customer.pincode || ""}` : "No address provided"}
                                    </span>
                                 </div>
                               </div>

                               {/* Assignment Section */}
                               <div className="space-y-1">
                                 <p className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Assignment & Type</p>
                                 <div className="flex items-center gap-2 text-xs text-gray-600 mt-2">
                                    <FaUserTie className="text-secondary text-[10px]" />
                                    <span className="font-semibold">{customer.salesOwner?.name || "No Sales Owner assigned"}</span>
                                 </div>
                                 <div className="flex items-center gap-2 text-xs text-gray-600 mt-1">
                                    <FaTags className="text-secondary text-[10px]" />
                                    <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[9px] font-bold">
                                      {customer.customerCategory?.name || "No Category"}
                                    </span>
                                    <span className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded text-[9px] font-bold">
                                      {customer.customerGroup?.name || "No Group"}
                                    </span>
                                 </div>
                                 <div className="mt-3">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedLedgerCustomer(customer);
                                      }}
                                      className="text-secondary hover:underline text-xs font-bold"
                                    >
                                      View Detailed Ledger →
                                    </button>
                                 </div>
                               </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
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

      {isAddModalOpen && (
        <InventoryAddCustomerModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSave={handleAddCustomer}
          salesOwners={salesOwners}
          customerCategories={customerCategories}
          customerGroups={customerGroups}
          branchId={branchId}
        />
      )}
    </div>
  );
};


export default BranchCustomers;
