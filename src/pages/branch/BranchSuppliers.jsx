import React, { useEffect, useState } from "react";
import { FaList, FaSpinner, FaThLarge, FaPlus, FaFileExport, FaChevronDown, FaChevronUp, FaMapMarkerAlt, FaPhone, FaEnvelope, FaMoneyBillWave, FaExchangeAlt, FaUndoAlt, FaBook, FaEdit, FaUserPlus } from "react-icons/fa";
import * as XLSX from 'xlsx';
import { toast } from "react-toastify";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";
import { useInventory } from "../../context/InventoryContext";
import VendorLedgerModal from "../../components/branch/VendorLedgerModal";
import InventoryAddVendorModal from "../../components/inventory/InventoryAddVendorModal";
import VendorCreditPaymentModal from "../../components/inventory/VendorCreditPaymentModal";
import SupplierDebitNoteModal from "../../components/inventory/SupplierDebitNoteModal";


const BranchSuppliers = () => {
  const { branch, branchLoaded, user } = useBranch();
  const branchId = branch?._id;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Permission helper
  const isFieldAllowed = (fieldId) => {
    if (!user) return false;
    if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") return true;
    const key = `suppliers_${fieldId}`;
    return user.fieldPermissions?.[key] !== false; // Default to true
  };

  const { addData, updateData } = useInventory();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("table");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  // const [purchaseOrders, setPurchaseOrders] = useState([]);
  // const [payments, setPayments] = useState([]);
  const [selectedLedgerSupplier, setSelectedLedgerSupplier] = useState(null);
  const [selectedPaySupplier, setSelectedPaySupplier] = useState(null);
  const [selectedDnSupplier, setSelectedDnSupplier] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const limit = 50;


  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setPage(1); // Reset to page 1 on new search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (branchLoaded && branchId) {
      fetchSuppliers(debouncedSearchTerm, page);
    }
  }, [branchLoaded, branchId, debouncedSearchTerm, page]);

  useEffect(() => {
    const ledgerVendorId = searchParams.get("ledgerVendorId");
    if (ledgerVendorId && branchLoaded) {
      // Fetch specifically this vendor to open the ledger
      const fetchSpecificVendor = async () => {
        try {
          const res = await fetchWithAuth(`${API_BASE}/vendors/${ledgerVendorId}`);
          const data = await res.json();
          if (res.ok) {
            setSelectedLedgerSupplier(data);
          }
        } catch (err) {
          console.error("Error fetching specific vendor for ledger:", err);
        }
      };
      fetchSpecificVendor();
    }
  }, [searchParams, branchLoaded]);

  const fetchSuppliers = async (search = "", pageNum = 1) => {
    try {
      setLoading(true);

      // Fetch vendors with search and pagination
      const vendorUrl = `${API_BASE}/vendors?branchId=${branchId}&search=${encodeURIComponent(search)}&page=${pageNum}&limit=${limit}`;
      const vendorResponse = await fetchWithAuth(vendorUrl);

      if (!vendorResponse.ok) {
        throw new Error("Failed to fetch suppliers");
      }

      let vendorData = await vendorResponse.json();
      let suppliers = vendorData.data || [];
      
      setSuppliers(suppliers);
      setTotalPages(vendorData.pagination?.pages || 1);
      setTotalItems(vendorData.pagination?.total || 0);

      if (suppliers.length === 0) {
        toast.info("No suppliers found");
      }
    } catch (err) {
      console.error("Error fetching suppliers:", err);
      toast.error("Failed to load suppliers");
    } finally {
      setLoading(false);
    }
  };

  const handleAddSupplier = async (data) => {
    try {
      if (data._id) {
        const { _id, ...updatePayload } = data;
        await updateData("vendor", _id, updatePayload);
        toast.success("Supplier updated successfully");
      } else {
        const dataWithBranch = { ...data, branchId };
        await addData("vendor", dataWithBranch);
        toast.success("Supplier added successfully");
      }
      fetchSuppliers();
    } catch (error) {
      console.error("Error saving supplier:", error);
      toast.error("Failed to save supplier");
    } finally {
      setEditingSupplier(null);
    }
  };

  const handleEdit = (supplier) => {
    setEditingSupplier(supplier);
    setIsAddModalOpen(true);
  };

  const handleMakeCustomer = async (supplier) => {
    try {
      const confirm = window.confirm(`Are you sure you want to create or link a customer record for "${supplier.name}"? This will consolidate all sales and purchases into this vendor's ledger.`);
      if (!confirm) return;

      const customerData = {
        name: supplier.name,
        phone: supplier.phone,
        whatsapp: supplier.phone,
        email: supplier.email,
        address: supplier.address,
        gstin: supplier.gstin,
        state: supplier.stateName,
        linkedVendorId: supplier._id,
        branchId: branchId,
        registrationType: supplier.gstRegistrationType || "regular"
      };

      // Check if customer already exists with this name to perform a link instead of create
      const checkRes = await fetchWithAuth(`${API_BASE}/customers?branchId=${branchId}&search=${encodeURIComponent(supplier.name)}&limit=1`);
      const checkData = await checkRes.json();
      const existingCustomer = checkData.data?.find(c => c.name.toLowerCase() === supplier.name.toLowerCase());

      if (existingCustomer) {
        if (existingCustomer.linkedVendorId === supplier._id) {
          return toast.info("This vendor is already linked to its customer record.");
        }
        
        const linkConfirm = window.confirm(`A customer named "${supplier.name}" already exists. Should we link it to this vendor for consolidated ledger reporting?`);
        if (linkConfirm) {
          await updateData("customer", existingCustomer._id, { linkedVendorId: supplier._id });
          toast.success(`Successfully linked existing customer "${supplier.name}" to this vendor.`);
          return;
        }
      }

      await addData("customer", customerData);
      toast.success(`${supplier.name} is now also a Customer and linked successfully!`);
    } catch (error) {
      console.error("Make Customer Error:", error);
      toast.error(error.message || "Failed to create customer");
    }
  };


  // Helper function to get outstanding PO count for a supplier
  // Helper function removed for performance
  const getOutstandingPOCount = (supplierName) => {
    return 0; // Simplified for speed
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const getSortedSuppliers = (data) => {
    return [...data].sort((a, b) => {
      const { key, direction } = sortConfig;

      if (key === "name") {
        const valA = a.name.toLowerCase();
        const valB = b.name.toLowerCase();
        if (valA < valB) return direction === "asc" ? -1 : 1;
        if (valA > valB) return direction === "asc" ? 1 : -1;
        return 0;
      }

      if (key === "outstandingPOs") {
        const valA = getOutstandingPOCount(a.name);
        const valB = getOutstandingPOCount(b.name);
        return direction === "asc" ? valA - valB : valB - valA;
      }

      if (key === "credit" || key === "debit") {
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

  const filteredSuppliers = getSortedSuppliers(suppliers);

  const handleExportExcel = () => {
    try {
      const exportData = filteredSuppliers.map(s => ({
        "Supplier Name": s.name || "-",
        "Credit": s.credit || 0,
        "Debit": s.debit || 0
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Suppliers");

      // Auto-width adjustment
      const wscols = [
        { wch: 30 }, // Supplier Name
        { wch: 15 }, // Credit
        { wch: 15 }  // Debit
      ];
      worksheet['!cols'] = wscols;

      XLSX.writeFile(workbook, `Suppliers_List.xlsx`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export suppliers");
    }
  };

  const handleExportSnapshot = async () => {
    try {
      setLoading(true);
      const url = `${API_BASE}/vendors/export/snapshot-mar31?branchId=${branchId}`;
      const response = await fetchWithAuth(url);
      const result = await response.json();

      if (!result.success) throw new Error(result.message || "Export failed");

      const worksheet = XLSX.utils.json_to_sheet(result.data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Vendor_March_31_Balances");

      // Auto-width adjustment
      const wscols = [
        { wch: 35 }, // Name
        { wch: 20 }, // GSTIN
        { wch: 20 }, // Phone
        { wch: 20 }, // Debit
        { wch: 20 }  // Credit
      ];
      worksheet['!cols'] = wscols;

      XLSX.writeFile(workbook, `Creditors_Balances_Snapshot_31Mar2026.xlsx`);
      toast.success("March 31st snapshot exported successfully!");
    } catch (error) {
      console.error("Snapshot export error:", error);
      toast.error(`Export failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
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
      {/* Header & Controls */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6 mx-4 md:mx-6 mt-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-2.5 rounded-xl">
              <FaList className="text-xl text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight">
                Suppliers (Creditors)
              </h1>
              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">
                Manage your vendor accounts and balances
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => navigate("/branch/supplier-transactions")}
              className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 text-sm shadow-md active:scale-95"
            >
              <FaExchangeAlt /> All Transactions
            </button>

            <button
              onClick={() => {
                setEditingSupplier(null);
                setIsAddModalOpen(true);
              }}
              className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 text-sm shadow-md active:scale-95"
            >
              <FaPlus /> Add Supplier
            </button>

            {(user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" || user?.actionPermissions?.export !== false) && (
              <>
                <button
                  onClick={handleExportExcel}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 text-sm shadow-md active:scale-95"
                >
                  <FaFileExport /> Export
                </button>
                <button
                  onClick={handleExportSnapshot}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 text-sm shadow-md active:scale-95"
                >
                  <FaFileExport /> 31st Mar Snapshot
                </button>
              </>
            )}

            <div className="flex bg-gray-100 p-1 rounded-xl items-center">
              <button
                onClick={() => setViewMode("table")}
                className={`p-2 rounded-lg transition-all ${viewMode === "table"
                    ? "bg-white text-primary shadow-sm"
                    : "text-gray-400 hover:text-gray-600"
                  }`}
              >
                <FaList size={18} />
              </button>
              <button
                onClick={() => setViewMode("card")}
                className={`p-2 rounded-lg transition-all ${viewMode === "card"
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


      <div className="w-full px-4 md:px-6 py-6 space-y-6">
        {/* Information Banner */}
        <div className="bg-blue-50 border border-blue-300 rounded-lg p-4 md:p-5">
          <p className="text-xs md:text-sm text-blue-800">
            <span className="font-semibold">💡 Credit Calculation:</span> Vendor credit is updated automatically when a Purchase Invoice is generated or re-invoiced. Payments made to the vendor reduce the credit balance.
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
          {isFieldAllowed("credit") && (
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
          )}
          {isFieldAllowed("debit") && (
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
          )}
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

            {/* Pagination Info */}
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">
              Showing {suppliers.length} of {totalItems} Suppliers
            </div>

            {/* View Toggle */}
            <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition font-medium ${viewMode === "table"
                    ? "bg-white text-blue-600 shadow-md"
                    : "text-gray-600 hover:text-blue-600"
                  }`}
              >
                <FaList size={16} /> Table
              </button>
              <button
                onClick={() => setViewMode("card")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition font-medium ${viewMode === "card"
                    ? "bg-white text-blue-600 shadow-md"
                    : "text-gray-600 hover:text-blue-600"
                  }`}
              >
                <FaThLarge size={16} /> Card
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
                {isFieldAllowed("gstin") && supplier.gstin && (
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
                {isFieldAllowed("credit") && (
                  <div className="bg-red-50 rounded-lg p-3 text-center border border-red-200">
                    <p className="text-xs text-red-700 font-bold uppercase">Credit Pending</p>
                    <p className="text-sm md:text-base font-bold text-red-600 mt-1">
                      ₹{(supplier.credit || 0).toFixed(2)}
                    </p>
                    <p className="text-xs text-red-600 mt-1 uppercase">
                       Balance to Pay
                    </p>
                  </div>
                )}
                {isFieldAllowed("debit") && (
                  <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
                    <p className="text-xs text-green-700 font-bold uppercase">Debit</p>
                    <p className="text-sm md:text-base font-bold text-green-600 mt-1">
                      ₹{(supplier.debit || 0).toFixed(2)}
                    </p>
                  </div>
                )}
              </div>

              {/* Status */}
              <div className="flex items-center justify-center">
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase ${supplier.isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-700"
                    }`}
                >
                  {supplier.isActive ? "✓ Active" : "Inactive"}
                </span>
              </div>

              {/* Pay, Debit Note & Ledger Buttons */}
              <div className="mt-4 pt-3 border-t border-gray-100 flex gap-1.5">
                <button
                  onClick={() => setSelectedPaySupplier(supplier)}
                  className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg border border-emerald-200 text-xs flex items-center justify-center gap-1 transition"
                >
                  <FaMoneyBillWave /> Pay
                </button>
                <button
                  onClick={() => setSelectedDnSupplier(supplier)}
                  className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-lg border border-red-200 text-xs flex items-center justify-center gap-1 transition"
                >
                  <FaUndoAlt /> Return
                </button>
                <button
                  onClick={() => setSelectedLedgerSupplier(supplier)}
                  className="flex-1 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold rounded-lg border border-teal-200 text-xs flex items-center justify-center gap-1 transition"
                >
                  <span>📅</span> Ledger
                </button>
                <button
                  onClick={() => handleEdit(supplier)}
                  className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg border border-blue-200 transition active:scale-95"
                  title="Edit Supplier"
                >
                  <FaEdit />
                </button>
                <button
                  onClick={() => handleMakeCustomer(supplier)}
                  className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg border border-indigo-200 transition active:scale-95"
                  title="Make as Customer"
                >
                  <FaUserPlus />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (

        <div className="bg-white rounded-lg shadow-md overflow-x-auto -mx-4 md:mx-0 md:rounded-lg">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <tr>
                <th className="w-10"></th>
                {isFieldAllowed("supplierName") && (
                  <th className="px-3 md:px-5 py-2 md:py-3 text-left text-xs md:text-sm font-bold cursor-pointer hover:bg-blue-800 transition" onClick={() => handleSort("name")}>
                    Supplier Name {sortConfig.key === "name" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "⇅"}
                  </th>
                )}
                {isFieldAllowed("gstin") && (
                  <th className="px-3 md:px-5 py-2 md:py-3 text-left text-xs md:text-sm font-bold">
                    GSTIN
                  </th>
                )}
                {isFieldAllowed("pos") && (
                  <th className="px-3 md:px-5 py-2 md:py-3 text-center text-xs md:text-sm font-bold cursor-pointer hover:bg-blue-800 transition" onClick={() => handleSort("outstandingPOs")}>
                    POs {sortConfig.key === "outstandingPOs" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "⇅"}
                  </th>
                )}
                {isFieldAllowed("credit") && (
                  <th className="px-3 md:px-5 py-2 md:py-3 text-right text-xs md:text-sm font-bold cursor-pointer hover:bg-blue-800 transition" onClick={() => handleSort("credit")}>
                    Credit {sortConfig.key === "credit" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "⇅"}
                  </th>
                )}
                {isFieldAllowed("debit") && (
                  <th className="px-3 md:px-5 py-2 md:py-3 text-right text-xs md:text-sm font-bold cursor-pointer hover:bg-blue-800 transition" onClick={() => handleSort("debit")}>
                    Debit {sortConfig.key === "debit" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "⇅"}
                  </th>
                )}
                  {(isFieldAllowed("action_pay") || isFieldAllowed("action_return") || isFieldAllowed("action_ledger")) && (
                    <th className="px-3 md:px-5 py-2 md:py-3 text-center text-[10px] md:text-xs font-bold uppercase tracking-wider">
                      Actions
                    </th>
                  )}
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.map((supplier, index) => {
                const isExpanded = !!expandedRows[supplier._id];
                return (
                  <React.Fragment key={supplier._id}>
                    <tr
                      className={`${index % 2 === 0 ? "bg-white" : "bg-blue-50"
                        } border-b border-gray-200 hover:bg-blue-100/50 transition cursor-pointer`}
                      onClick={() => toggleRow(supplier._id)}
                    >
                      <td className="px-4 py-3 text-center text-gray-400">
                        {isExpanded ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
                      </td>
                      {isFieldAllowed("supplierName") && (
                        <td className="px-3 md:px-5 py-2 md:py-3 text-xs md:text-sm font-semibold text-gray-800">
                          {supplier.name}
                        </td>
                      )}
                      {isFieldAllowed("gstin") && (
                        <td className="px-3 md:px-5 py-2 md:py-3 text-xs md:text-sm text-gray-700">
                          {supplier.gstin || "-"}
                        </td>
                      )}
                      {isFieldAllowed("pos") && (
                        <td className="px-3 md:px-5 py-2 md:py-3 text-xs md:text-sm text-center font-semibold text-gray-400">
                           -
                        </td>
                      )}
                      {isFieldAllowed("credit") && (
                        <td className="px-3 md:px-5 py-2 md:py-3 text-xs md:text-sm text-right font-bold text-red-600">
                          ₹{(supplier.credit || 0).toFixed(2)}
                        </td>
                      )}
                      {isFieldAllowed("debit") && (
                        <td className="px-3 md:px-5 py-2 md:py-3 text-xs md:text-sm text-right font-bold text-green-600">
                          ₹{(supplier.debit || 0).toFixed(2)}
                        </td>
                      )}
                      {(isFieldAllowed("action_pay") || isFieldAllowed("action_return") || isFieldAllowed("action_ledger")) && (
                        <td className="px-3 md:px-5 py-2 md:py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {isFieldAllowed("action_pay") && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelectedPaySupplier(supplier); }}
                                className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-md text-xs font-bold transition whitespace-nowrap flex items-center gap-1"
                              >
                                <FaMoneyBillWave className="text-[9px]" /> Pay
                              </button>
                            )}
                            {isFieldAllowed("action_return") && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelectedDnSupplier(supplier); }}
                                className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-md text-xs font-bold transition whitespace-nowrap flex items-center gap-1"
                              >
                                <FaUndoAlt className="text-[9px]" /> Return
                              </button>
                            )}
                            {isFieldAllowed("action_ledger") && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelectedLedgerSupplier(supplier); }}
                                className="bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 px-2.5 py-1 rounded-md text-xs font-bold transition whitespace-nowrap flex items-center gap-1"
                              >
                                <FaBook className="text-[9px]" /> Ledger
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleEdit(supplier); }}
                              className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 rounded-md transition active:scale-95"
                              title="Edit Supplier"
                            >
                              <FaEdit size={10} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleMakeCustomer(supplier); }}
                              className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 rounded-md transition active:scale-95"
                              title="Make as Customer"
                            >
                              <FaUserPlus size={10} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <td colSpan={7} className="px-8 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fadeIn">
                            {/* Address section */}
                            <div className="space-y-1">
                              <p className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Contact Details</p>
                              <div className="flex items-center gap-2 text-xs text-gray-600 mt-2">
                                <FaPhone className="text-primary text-[10px]" />
                                <span>{supplier.phone || "No phone provided"}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-600">
                                <FaEnvelope className="text-primary text-[10px]" />
                                <span>{supplier.email || "No email provided"}</span>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <p className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Location Info</p>
                              <div className="flex items-start gap-2 text-xs text-gray-600 mt-2">
                                <FaMapMarkerAlt className="text-primary text-[10px] mt-0.5" />
                                <span>{supplier.address ? `${supplier.address}, ${supplier.stateName || ""}` : "No address provided"}</span>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <p className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Account Status</p>
                              <div className="mt-2 text-xs">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full font-bold uppercase text-[9px] ${supplier.isActive
                                      ? "bg-green-100 text-green-700"
                                      : "bg-gray-100 text-gray-700"
                                    }`}
                                >
                                  {supplier.isActive ? "Active" : "Inactive"}
                                </span>
                              </div>
                              <div className="mt-3">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedLedgerSupplier(supplier);
                                  }}
                                  className="text-primary hover:underline text-xs font-bold"
                                >
                                  Open Ledger View →
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
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2 pb-10">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            Previous
          </button>
          
          <div className="flex items-center gap-1">
            {[...Array(totalPages)].map((_, i) => {
               const pNum = i + 1;
               // Show current, first, last and 2 neighbors
               if (pNum === 1 || pNum === totalPages || (pNum >= page - 1 && pNum <= page + 1)) {
                 return (
                   <button
                     key={pNum}
                     onClick={() => setPage(pNum)}
                     className={`w-10 h-10 rounded-xl font-bold transition-all ${
                       page === pNum 
                         ? "bg-blue-600 text-white shadow-md scale-110" 
                         : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                     }`}
                   >
                     {pNum}
                   </button>
                 );
               } else if (pNum === page - 2 || pNum === page + 2) {
                 return <span key={pNum} className="text-gray-400 font-bold px-1">...</span>;
               }
               return null;
            })}
          </div>

          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            Next
          </button>
        </div>
      )}

      {/* VENDOR LEDGER MODAL */}
      <VendorLedgerModal
        isOpen={!!selectedLedgerSupplier}
        onClose={() => setSelectedLedgerSupplier(null)}
        supplier={selectedLedgerSupplier}
      />

      {/* SUPPLIER PAYMENT MODAL */}
      <VendorCreditPaymentModal
        isOpen={!!selectedPaySupplier}
        onClose={() => setSelectedPaySupplier(null)}
        preselectedVendor={selectedPaySupplier}
        onPaymentSuccess={() => { setSelectedPaySupplier(null); fetchSuppliers(); }}
      />

      {/* DEBIT NOTE MODAL */}
      <SupplierDebitNoteModal
        isOpen={!!selectedDnSupplier}
        onClose={() => setSelectedDnSupplier(null)}
        preselectedVendor={selectedDnSupplier}
        onSuccess={() => { setSelectedDnSupplier(null); fetchSuppliers(); }}
      />

      {isAddModalOpen && (
        <InventoryAddVendorModal
          isOpen={isAddModalOpen}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingSupplier(null);
          }}
          onSave={handleAddSupplier}
          branchId={branchId}
          editingItem={editingSupplier}
          user={user}
        />
      )}
    </div>
  );
};


export default BranchSuppliers;
