import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { FaList, FaSpinner, FaThLarge, FaPlus, FaUpload, FaFileExport, FaChevronDown, FaChevronUp, FaWhatsapp, FaMapMarkerAlt, FaEnvelope, FaUserTie, FaTags, FaObjectGroup, FaEdit, FaTruck } from "react-icons/fa";
import * as XLSX from 'xlsx';
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";
import { useInventory } from "../../context/InventoryContext";

import InventoryAddCustomerModal from "../../components/inventory/InventoryAddCustomerModal";
import CustomerReceiptModal from "../../components/inventory/CustomerReceiptModal";
import CustomerCreditNoteModal from "../../components/inventory/CustomerCreditNoteModal";


const BranchCustomers = () => {
  const navigate = useNavigate();
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
  const [viewMode, setViewMode] = useState("table"); // 'table' or 'card'
  
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({});

  const [selectedReceiptCustomer, setSelectedReceiptCustomer] = useState(null);

  const [selectedCreditNoteCustomer, setSelectedCreditNoteCustomer] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCustomerForEdit, setSelectedCustomerForEdit] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});
  const [exportDate, setExportDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSafeMode, setIsSafeMode] = useState(false); // Mode for info-only updates
  const fileInputRef = useRef(null);

  const handleExportBalances = async () => {
    try {
      setLoading(true);
      const url = `${API_BASE}/customers/export/opening-closing?branchId=${branchId}&date=${exportDate}`;
      const response = await fetchWithAuth(url);
      const result = await response.json();

      if (!result.success) throw new Error(result.message || "Export failed");

      const balanceData = result.data.map(c => ({
        "Customer Name": c.name,
        "GSTIN": c.gstin,
        "WhatsApp": c.whatsapp,
        [`Opening Balance (${exportDate})`]: c.openingBalance,
        "Closing Balance (Current)": c.closingBalance
      }));

      const worksheet = XLSX.utils.json_to_sheet(balanceData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Balances");
      XLSX.writeFile(workbook, `Debtors_Balances_${exportDate}_to_Current.xlsx`);
      toast.success("Opening balances exported successfully!");
    } catch (error) {
      console.error("Balance export error:", error);
      toast.error(`Export failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExportSnapshot = async () => {
    try {
      setLoading(true);
      const url = `${API_BASE}/customers/export/snapshot-mar31?branchId=${branchId}`;
      const response = await fetchWithAuth(url);
      const result = await response.json();

      if (!result.success) throw new Error(result.message || "Export failed");

      const worksheet = XLSX.utils.json_to_sheet(result.data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "March_31_Balances");

      // Auto-width adjustment
      const wscols = [
        { wch: 35 }, // Name
        { wch: 20 }, // GSTIN
        { wch: 20 }, // WhatsApp
        { wch: 20 }, // Debit
        { wch: 20 }  // Credit
      ];
      worksheet['!cols'] = wscols;

      XLSX.writeFile(workbook, `Customer_Balances_Snapshot_31Mar2026.xlsx`);
      toast.success("March 31st snapshot exported successfully!");
    } catch (error) {
      console.error("Snapshot export error:", error);
      toast.error(`Export failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };



  useEffect(() => {
    console.log("BranchCustomers mounted");
    console.log("branchLoaded:", branchLoaded);
    console.log("branch:", branch);
    console.log("branchId:", branchId);

    if (branchLoaded && branchId) {
      fetchCustomers(1);
    }
  }, [branchLoaded, branchId]);



  const fetchCustomers = async (page = 1) => {
    try {
      setLoading(true);
      const url = `${API_BASE}/customers?branchId=${branchId}&page=${page}&limit=100&search=${encodeURIComponent(
        searchTerm
      )}`;
      console.log("Fetching customers from:", url);
      console.log("Branch ID:", branchId);

      const response = await fetchWithAuth(url);

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
        setSelectedCustomerForEdit(null);
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

  const handleMergeCustomers = async () => {
    const sourceName = prompt("MERGE: Enter name of DUPLICATE customer to REMOVE:");
    if (!sourceName) return;

    try {
      toast.loading("Searching for source customer...", { id: "merge" });
      const srcRes = await fetchWithAuth(`${API_BASE}/customers?branchId=${branchId}&search=${encodeURIComponent(sourceName)}&limit=5`);
      const srcData = await srcRes.json();
      
      if (!srcData.data || srcData.data.length === 0) {
        return toast.error("Source customer not found", { id: "merge" });
      }
      const source = srcData.data[0];

      const targetName = prompt(`MERGE: "${source.name}" found. Now enter name of MASTER customer to KEEP:`);
      if (!targetName) return toast.dismiss("merge");

      const tarRes = await fetchWithAuth(`${API_BASE}/customers?branchId=${branchId}&search=${encodeURIComponent(targetName)}&limit=5`);
      const tarData = await tarRes.json();
      
      if (!tarData.data || tarData.data.length === 0) {
        return toast.error("Master customer not found", { id: "merge" });
      }
      const target = tarData.data[0];

      if (source._id === target._id) {
        return toast.error("Cannot merge a customer into itself", { id: "merge" });
      }

      if (!window.confirm(`⚠️ FINAL WARNING: This will DELETE "${source.name}" and move all their data (Invoices, Receipts, Balance) to "${target.name}". This action is IRREVERSIBLE. Proceed?`)) {
        return toast.dismiss("merge");
      }

      const res = await fetchWithAuth(`${API_BASE}/customers/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: source._id, targetId: target._id })
      });

      const result = await res.json();
      if (result.success) {
        toast.success(result.message, { id: "merge" });
        fetchCustomers(1);
      } else {
        toast.error(result.message || "Merge failed", { id: "merge" });
      }
    } catch (err) {
      console.error("Merge error:", err);
      toast.error("An error occurred during merge", { id: "merge" });
    }
  };

  const handleMakeVendor = async (customer) => {
    if (customer.linkedVendorId) {
      return toast.info("This customer is already linked to a vendor.");
    }

    try {
      toast.loading(`Checking for existing vendor: ${customer.name}...`, { id: "make-vendor" });
      
      // 1. Search for existing vendor by name
      const searchRes = await fetchWithAuth(`${API_BASE}/vendors?branchId=${branchId}&search=${encodeURIComponent(customer.name)}&limit=5`);
      const searchData = await searchRes.json();
      
      let targetVendorId = null;
      const existingVendor = (searchData.data || []).find(v => v.name.toLowerCase().trim() === customer.name.toLowerCase().trim());

      if (existingVendor) {
        toast.dismiss("make-vendor");
        if (window.confirm(`A vendor named "${existingVendor.name}" already exists. Link this customer to that vendor profile for a consolidated ledger?`)) {
          targetVendorId = existingVendor._id;
        } else {
          return;
        }
      } else {
        toast.dismiss("make-vendor");
        if (!window.confirm(`Create a new Vendor profile for "${customer.name}" and link it to this customer?`)) {
          return;
        }
        
        toast.loading("Creating vendor profile...", { id: "make-vendor" });
        const createRes = await fetchWithAuth(`${API_BASE}/vendors`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: customer.name,
            email: customer.email,
            phone: customer.whatsapp,
            address: customer.address,
            gstin: customer.gstin,
            branchId: branchId,
            openingBalance: 0
          })
        });
        
        const createData = await createRes.json();
        if (!createRes.ok) throw new Error(createData.message || "Failed to create vendor");
        targetVendorId = createData.data?._id || createData._id;
      }

      if (targetVendorId) {
        toast.loading("Linking profiles...", { id: "make-vendor" });
        const linkRes = await fetchWithAuth(`${API_BASE}/customers/${customer._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ linkedVendorId: targetVendorId })
        });
        
        if (linkRes.ok) {
          toast.success("Successfully linked to Vendor profile!", { id: "make-vendor" });
          fetchCustomers(currentPage);
        } else {
          throw new Error("Failed to update customer link");
        }
      }
    } catch (err) {
      console.error("Make Vendor Error:", err);
      toast.error(err.message || "An error occurred", { id: "make-vendor" });
    }
  };


  // Customer debit is already provided natively by the backend API.
  // There is no need for local array re-calculation.

  // Global Totals calculation
  const baseGlobalCredit = pagination?.totalGlobalCredit || 0;
  const baseGlobalDebit = pagination?.totalGlobalDebit || 0;

  const totalCredit = baseGlobalCredit;
  const totalDebit = baseGlobalDebit;

  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("branchId", branchId);
    formData.append("updateMode", isSafeMode ? "info_only" : "opening_balance");

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/customers/bulk-upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      });

      const result = await res.json();
      if (res.ok) {
        toast.success(`Upload Result: ${result.insertedCount} New, ${result.updatedCount} Updated, ${result.skippedCount || 0} Skipped.`);
        fetchCustomers(1);
      } else {
        throw new Error(result.message || "Bulk upload failed");
      }
    } catch (err) {
      console.error("Bulk upload error:", err);
      toast.error(`Error: ${err.message}`);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = ""; // Reset input
    }
  };

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
      const response = await fetchWithAuth(url);
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

            {(user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") && (
              <button
                onClick={handleMergeCustomers}
                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 text-sm shadow-md active:scale-95"
                title="Merge two customer records into one"
              >
                <FaObjectGroup /> Merge Records
              </button>
            )}

            <div className="flex items-center gap-3 bg-white p-2 px-4 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-gray-400 uppercase leading-none">Safe Mode</span>
                <span className="text-[8px] font-bold text-gray-500 uppercase leading-tight">Info Only</span>
              </div>
              <button
                onClick={() => setIsSafeMode(!isSafeMode)}
                className={`w-10 h-5 rounded-full transition-all relative ${isSafeMode ? 'bg-emerald-500' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${isSafeMode ? 'left-5.5' : 'left-0.5'}`} style={{ left: isSafeMode ? '1.35rem' : '0.125rem' }}></div>
              </button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleBulkUpload}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
            <button
              onClick={() => {
                if (!isSafeMode) {
                  const confirmBal = window.confirm("⚠️ You are uploading in BALANCING MODE. This will adjust Debit/Credit balances. For info-only updates, enable SAFE MODE. Proceed?");
                  if (!confirmBal) return;
                }
                fileInputRef.current?.click();
              }}
              className={`${isSafeMode ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-purple-600 hover:bg-purple-700'} text-white px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 text-sm shadow-md active:scale-95`}
            >
              <FaUpload /> {isSafeMode ? "Safe Update" : "Bulk Upload"}
            </button>

            {(user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" || user?.actionPermissions?.export !== false) && (
              <>
                <button
                  onClick={handleExportExcel}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 text-sm shadow-md active:scale-95"
                >
                  <FaFileExport /> Export Excel
                </button>

                <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <input
                    type="date"
                    value={exportDate}
                    onChange={(e) => setExportDate(e.target.value)}
                    className="bg-white border border-slate-200 text-[11px] font-bold rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-primary outline-none"
                  />
                  <button
                    onClick={handleExportBalances}
                    className="bg-primary hover:bg-primary/90 text-white px-3 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all shadow-md flex items-center gap-2"
                  >
                    <FaFileExport /> Export Balances
                  </button>
                </div>

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
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-base md:text-lg font-bold text-gray-800 truncate flex items-center gap-2">
                      {customer.name}
                      {customer.linkedVendorId && (
                        <span className="bg-indigo-100 text-indigo-700 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter shadow-sm border border-indigo-200">
                          Consolidated
                        </span>
                      )}
                    </h3>
                    <button 
                      onClick={() => { setSelectedCustomerForEdit(customer); setIsAddModalOpen(true); }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Edit Customer"
                    >
                      <FaEdit size={14} />
                    </button>
                  </div>

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

                  <div className="mt-4 pt-3 border-t border-gray-100 flex gap-1.5 flex-wrap">
                    <button
                      onClick={() => setSelectedReceiptCustomer(customer)}
                      className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg border border-emerald-200 text-xs flex items-center justify-center gap-1 transition"
                    >
                      <span>💰</span> Receipt
                    </button>
                    <button
                      onClick={() => setSelectedCreditNoteCustomer(customer)}
                      className="flex-1 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-lg border border-rose-200 text-xs flex items-center justify-center gap-1 transition"
                    >
                      <span>↩️</span> Return
                    </button>
                    <button
                      onClick={() => navigate(`/branch/customer-ledger/${customer._id}`)}
                      className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg border border-blue-200 text-xs flex items-center justify-center gap-1 transition"
                    >

                      <span>📅</span> Ledger
                    </button>
                    {!customer.linkedVendorId && (
                      <button
                        onClick={() => handleMakeVendor(customer)}
                        className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg border border-indigo-200 text-xs flex items-center justify-center gap-1 transition"
                        title="Link to Vendor profile"
                      >
                        <span>🚚</span> Make Vendor
                      </button>
                    )}
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
                    {isFieldAllowed("name") && (
                      <th className="px-3 md:px-5 py-2 md:py-3 text-left text-xs md:text-sm font-bold cursor-pointer hover:bg-blue-800 transition" onClick={() => handleSort("name")}>
                        Customer Name {sortConfig.key === "name" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "⇅"}
                      </th>
                    )}
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
                    {(isFieldAllowed("action_receipt") || isFieldAllowed("action_return") || isFieldAllowed("action_ledger")) && (
                      <th className="px-3 md:px-5 py-2 md:py-3 text-center text-xs md:text-sm font-bold">
                        Action
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {sortedCustomers.map((customer, index) => {
                    const isExpanded = !!expandedRows[customer._id];
                    return (
                      <React.Fragment key={customer._id}>
                        <tr
                          className={`${index % 2 === 0 ? "bg-white" : "bg-blue-50"
                            } border-b border-gray-200 hover:bg-blue-100/50 transition cursor-pointer`}
                          onClick={() => toggleRow(customer._id)}
                        >
                          <td className="px-4 py-3 text-center text-gray-400">
                            {isExpanded ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
                          </td>
                          {isFieldAllowed("name") && (
                            <td className="px-3 md:px-5 py-2 md:py-3 text-xs md:text-sm font-semibold text-gray-800">
                              <div className="flex items-center gap-2">
                                {customer.name}
                                {customer.linkedVendorId && (
                                  <span className="bg-indigo-100 text-indigo-700 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter border border-indigo-200" title="Consolidated with Vendor Account">
                                    Linked
                                  </span>
                                )}
                              </div>
                            </td>
                          )}
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
                          {(isFieldAllowed("action_receipt") || isFieldAllowed("action_return") || isFieldAllowed("action_ledger")) && (
                            <td className="px-3 md:px-5 py-2 md:py-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {isFieldAllowed("action_receipt") && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setSelectedReceiptCustomer(customer); }}
                                    className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-tighter transition shadow-sm whitespace-nowrap"
                                  >
                                    Receipt
                                  </button>
                                )}
                                {isFieldAllowed("action_return") && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setSelectedCreditNoteCustomer(customer); }}
                                    className="bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 px-2.5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-tighter transition shadow-sm whitespace-nowrap"
                                  >
                                    Return
                                  </button>
                                )}
                                  {isFieldAllowed("action_ledger") && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); navigate(`/branch/customer-ledger/${customer._id}`); }}
                                      className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-2.5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-tighter transition shadow-sm whitespace-nowrap"
                                    >
                                      Ledger
                                    </button>
                                  )}
                                  {!customer.linkedVendorId && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleMakeVendor(customer); }}
                                      className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-tighter transition shadow-sm whitespace-nowrap flex items-center gap-1"
                                      title="Convert/Link to Vendor"
                                    >
                                      <FaTruck size={10} /> Vendor
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedCustomerForEdit(customer);
                                      setIsAddModalOpen(true);
                                    }}
                                    className="bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200 p-2 rounded-md transition shadow-sm"
                                    title="Edit Profile"
                                  >
                                    <FaEdit size={10} />
                                  </button>
                                </div>
                            </td>
                          )}
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
                                  <div className="mt-3 flex items-center gap-4">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/branch/customer-ledger/${customer._id}`);
                                      }}
                                      className="text-secondary hover:underline text-xs font-bold"
                                    >
                                      View Detailed Ledger →
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedCustomerForEdit(customer);
                                        setIsAddModalOpen(true);
                                      }}
                                      className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-[10px] font-black uppercase tracking-widest border border-blue-200 px-2 py-1 rounded-lg bg-blue-50 transition-all active:scale-95"
                                    >
                                      <FaEdit size={10} /> Edit Profile
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

      {/* RECEIPT MODAL */}

      <CustomerReceiptModal
        isOpen={!!selectedReceiptCustomer}
        onClose={() => setSelectedReceiptCustomer(null)}
        customer={selectedReceiptCustomer}
        onPaymentSuccess={() => { setSelectedReceiptCustomer(null); fetchCustomers(currentPage); }}
      />

      {/* CREDIT NOTE MODAL */}
      <CustomerCreditNoteModal
        isOpen={!!selectedCreditNoteCustomer}
        onClose={() => setSelectedCreditNoteCustomer(null)}
        customer={selectedCreditNoteCustomer}
        onCreditSuccess={() => { setSelectedCreditNoteCustomer(null); fetchCustomers(currentPage); }}
      />

      {isAddModalOpen && (
        <InventoryAddCustomerModal
          isOpen={isAddModalOpen}
          onClose={() => {
            setIsAddModalOpen(false);
            setSelectedCustomerForEdit(null);
          }}
          onSave={handleAddCustomer}
          initialData={selectedCustomerForEdit}
          salesOwners={salesOwners}
          customerCategories={customerCategories}
          customerGroups={customerGroups}
          branchId={branchId}
          user={user}
        />
      )}
    </div>
  );
};


export default BranchCustomers;
