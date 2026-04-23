import React, { useState, useEffect, useRef } from "react";
import { FaLock, FaSync, FaSearch, FaUser, FaBox, FaTrash, FaPlus, FaCheckCircle, FaChevronDown, FaUpload, FaEdit, FaTimes, FaFileExcel } from "react-icons/fa";
import * as XLSX from "xlsx";
import { toast } from "react-toastify";
import { API_BASE } from "../../api";
import { useBranch } from "../../context/BranchContext";
import { useInventory } from "../../context/InventoryContext";

const BranchLockedPrices = () => {
  const { currentBranch, user } = useBranch();
  const { products } = useInventory();

  // Permission helper
  const isFieldAllowed = (fieldId) => {
    if (!user) return false;
    if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") return true;
    const key = `locked-prices_${fieldId}`;
    return user.fieldPermissions?.[key] !== false;
  };
  
  const [customers, setCustomers] = useState([]);
  const [lockedPrices, setLockedPrices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [custSearch, setCustSearch] = useState("");
  const [prodSearch, setProdSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [lockedPrice, setLockedPrice] = useState("");
  const [isLocked, setIsLocked] = useState(true);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [searchingCust, setSearchingCust] = useState(false);
  const [searchingProd, setSearchingProd] = useState(false);
  const [prodResults, setProdResults] = useState([]);
  const fileInputRef = useRef(null);

  // Filtration & Pagination State
  const [filters, setFilters] = useState({
    product: "",
    customer: "",
  });
  const [sortField, setSortField] = useState("updatedAt");
  const [sortOrder, setSortOrder] = useState(-1);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  
  // Inline Editing State
  const [editingId, setEditingId] = useState(null);
  const [editProduct, setEditProduct] = useState(null);
  const [editCustomer, setEditCustomer] = useState(null);
  const [editLockedPrice, setEditLockedPrice] = useState("");
  const [editProdSearch, setEditProdSearch] = useState("");
  const [editCustSearch, setEditCustSearch] = useState("");
  const [showEditProdDropdown, setShowEditProdDropdown] = useState(false);
  const [showEditCustDropdown, setShowEditCustDropdown] = useState(false);
  const [editProdResults, setEditProdResults] = useState([]);
  const [editCustResults, setEditCustResults] = useState([]);
  const [editSearchingProd, setEditSearchingProd] = useState(false);
  const [editSearchingCust, setEditSearchingCust] = useState(false);
  
  // New Row State
  const [isAdding, setIsAdding] = useState(false);
  const [newRowData, setNewRowData] = useState({
    customerId: "",
    customerName: "",
    productId: "",
    productName: "",
    purchasingPrice: 0,
    sellingPrice: 0,
    lockedPrice: "",
    custSearch: "",
    prodSearch: ""
  });
  const [showNewCustDropdown, setShowNewCustDropdown] = useState(false);
  const [showNewProdDropdown, setShowNewProdDropdown] = useState(false);
  const [newCustResults, setNewCustResults] = useState([]);
  const [newProdResults, setNewProdResults] = useState([]);
  const [newSearchingCust, setNewSearchingCust] = useState(false);
  const [newSearchingProd, setNewSearchingProd] = useState(false);

  useEffect(() => {
    if (currentBranch?._id) {
      fetchCustomers();
    }
  }, [currentBranch?._id]);

  useEffect(() => {
    fetchLockedPrices();
  }, [currentBranch?._id, page, sortField, sortOrder, filters.product, filters.customer]);

  // 🔒 AUTO-LOOKUP EXISTING PRICE
  useEffect(() => {
    const fetchExistingPrice = async () => {
      if (!selectedCustomer?._id || !selectedProduct?._id || !currentBranch?._id) return;
      
      try {
        const res = await fetch(`${API_BASE}/customer-locked-prices/${selectedCustomer._id}/${selectedProduct._id}?branchId=${currentBranch._id}`);
        const data = await res.json();
        
        if (data.success && data.data?.lockedPrice) {
          setLockedPrice(data.data.lockedPrice.toString());
          console.log(`🔒 Auto-filled Existing Locked Price: ${data.data.lockedPrice}`);
        } else {
          setLockedPrice(""); // No existing price, let them set a new one
        }
      } catch (err) {
        console.warn("Existing price lookup failed (likely no record yet)");
        setLockedPrice("");
      }
    };

    fetchExistingPrice();
  }, [selectedCustomer?._id, selectedProduct?._id, currentBranch?._id]);

  // 🔍 DEBOUNCED CUSTOMER SEARCH
  useEffect(() => {
    const searchCustomers = async () => {
      if (!custSearch.trim() || selectedCustomer) {
        if (!custSearch.trim() && !selectedCustomer) fetchCustomers(); // Reset to default list if search is empty and nothing selected
        return;
      }
      
      setSearchingCust(true);
      try {
        const res = await fetch(`${API_BASE}/customers?branchId=${currentBranch._id}&search=${custSearch}&limit=20`);
        const data = await res.json();
        setCustomers(data.data || []);
      } catch (err) {
        console.error("Search Customers Error:", err);
      } finally {
        setSearchingCust(false);
      }
    };

    const timer = setTimeout(searchCustomers, 500);
    return () => clearTimeout(timer);
  }, [custSearch, currentBranch?._id]);

  // 🔍 DEBOUNCED PRODUCT SEARCH
  useEffect(() => {
    const searchProducts = async () => {
      if (!prodSearch.trim() || selectedProduct) {
        // setProdResults([]); // Clear results if not searching
        return;
      }
      
      setSearchingProd(true);
      try {
        const res = await fetch(`${API_BASE}/products?branchId=${currentBranch._id}&search=${prodSearch}&limit=20`);
        const data = await res.json();
        setProdResults(data.data || []);
      } catch (err) {
        console.error("Search Products Error:", err);
      } finally {
        setSearchingProd(false);
      }
    };

    const timer = setTimeout(searchProducts, 500);
    return () => clearTimeout(timer);
  }, [prodSearch, currentBranch?._id]);

  // 🔍 DEBOUNCED EDIT CUSTOMER SEARCH
  useEffect(() => {
    const searchCustomers = async () => {
      if (!editCustSearch.trim() || editCustomer) return;
      
      setEditSearchingCust(true);
      try {
        const res = await fetch(`${API_BASE}/customers?branchId=${currentBranch._id}&search=${editCustSearch}&limit=20`);
        const data = await res.json();
        setEditCustResults(data.data || []);
      } catch (err) {
        console.error("Search Edit Customers Error:", err);
      } finally {
        setEditSearchingCust(false);
      }
    };

    const timer = setTimeout(searchCustomers, 500);
    return () => clearTimeout(timer);
  }, [editCustSearch, currentBranch?._id]);

  // 🔍 DEBOUNCED EDIT PRODUCT SEARCH
  useEffect(() => {
    const searchProducts = async () => {
      if (!editProdSearch.trim() || editProduct) return;
      
      setEditSearchingProd(true);
      try {
        const res = await fetch(`${API_BASE}/products?branchId=${currentBranch._id}&search=${editProdSearch}&limit=20`);
        const data = await res.json();
        setEditProdResults(data.data || []);
      } catch (err) {
        console.error("Search Edit Products Error:", err);
      } finally {
        setEditSearchingProd(false);
      }
    };

    const timer = setTimeout(searchProducts, 500);
    return () => clearTimeout(timer);
  }, [editProdSearch, currentBranch?._id]);

  // 🔍 DEBOUNCED NEW ROW CUSTOMER SEARCH
  useEffect(() => {
    const searchCustomers = async () => {
      if (!newRowData.custSearch.trim() || newRowData.customerId) return;
      
      setNewSearchingCust(true);
      try {
        const res = await fetch(`${API_BASE}/customers?branchId=${currentBranch._id}&search=${newRowData.custSearch}&limit=20`);
        const data = await res.json();
        setNewCustResults(data.data || []);
      } catch (err) {
        console.error("Search New Customers Error:", err);
      } finally {
        setNewSearchingCust(false);
      }
    };

    const timer = setTimeout(searchCustomers, 500);
    return () => clearTimeout(timer);
  }, [newRowData.custSearch, currentBranch?._id]);

  // 🔍 DEBOUNCED NEW ROW PRODUCT SEARCH
  useEffect(() => {
    const searchProducts = async () => {
      if (!newRowData.prodSearch.trim() || newRowData.productId) return;
      
      setNewSearchingProd(true);
      try {
        const res = await fetch(`${API_BASE}/products?branchId=${currentBranch._id}&search=${newRowData.prodSearch}&limit=20`);
        const data = await res.json();
        setNewProdResults(data.data || []);
      } catch (err) {
        console.error("Search New Products Error:", err);
      } finally {
        setNewSearchingProd(false);
      }
    };

    const timer = setTimeout(searchProducts, 500);
    return () => clearTimeout(timer);
  }, [newRowData.prodSearch, currentBranch?._id]);

  const fetchCustomers = async () => {
    try {
      const res = await fetch(`${API_BASE}/customers?branchId=${currentBranch._id}`);
      const data = await res.json();
      // customerRoutes.js returns { success: true, data: [...] }
      setCustomers(data.data || []);
    } catch (err) {
      console.error("Fetch Customers Error:", err);
    }
  };

  const fetchLockedPrices = async () => {
    if (!currentBranch?._id) return;
    setLoading(true);
    try {
      let url = `${API_BASE}/customer-locked-prices/branch/${currentBranch._id}?page=${page}&limit=50&sortField=${sortField}&sortOrder=${sortOrder}`;
      if (filters.product) url += `&productName=${encodeURIComponent(filters.product)}`;
      if (filters.customer) url += `&customerName=${encodeURIComponent(filters.customer)}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      const data = await res.json();
      if (data.success) {
        setLockedPrices(data.data || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotalRecords(data.pagination?.totalRecords || 0);
      } else {
        throw new Error(data.message || "Failed to fetch");
      }
    } catch (err) {
      console.error("Fetch Locked Prices Error:", err);
      toast.error("Failed to fetch locked prices");
    } finally {
      setLoading(false);
      setSelectedIds([]); // Clear selection on new fetch
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === lockedPrices.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(lockedPrices.map(lp => lp._id));
    }
  };

  const toggleSelectRow = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(i => i !== id));
    } else {
      setSelectedIds(prev => [...prev, id]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to remove ${selectedIds.length} locked prices?`)) return;

    setBulkDeleting(true);
    try {
      const resp = await fetch(`${API_BASE}/customer-locked-prices/bulk-delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds })
      });
      const data = await resp.json();
      if (data.success) {
        toast.success(data.message);
        setSelectedIds([]);
        fetchLockedPrices();
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      toast.error(err.message || "Bulk delete failed");
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 1 ? -1 : 1);
    } else {
      setSortField(field);
      setSortOrder(1);
    }
    setPage(1); // Reset to first page on sort
  };

  const handleSave = async () => {
    if (!selectedCustomer?._id || !selectedProduct?._id || !lockedPrice) {
      return toast.warn("Please select customer, product, and set a price");
    }

    setSaving(true);
    try {
      const resp = await fetch(`${API_BASE}/customer-locked-prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: currentBranch._id,
          customerId: selectedCustomer._id,
          productId: selectedProduct._id,
          lockedPrice: Number(lockedPrice),
        }),
      });

      const data = await resp.json();
      if (data.success) {
        toast.success("Price locked successfully");
        fetchLockedPrices();
        // Reset form (keep customer for multiple products if wanted, or clear)
        setSelectedProduct(null);
        setLockedPrice("");
        setProdSearch("");
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      toast.error(err.message || "Failed to save locked price");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to remove this locked price?")) return;
    
    try {
      // Assuming a delete route exists or using the POST with lockedPrice: 0 logic if needed
      // But we should ideally have a DELETE route. For now, let's assume we can delete.
      const resp = await fetch(`${API_BASE}/customer-locked-prices/${id}`, { method: "DELETE" });
      if (resp.ok) {
        toast.success("Locked price removed");
        fetchLockedPrices();
      }
    } catch (err) {
      toast.error("Failed to delete");
    }
  };
  
  const startInlineEdit = (lp) => {
    setEditingId(lp._id);
    setEditProduct(lp.productId);
    setEditCustomer(lp.customerId);
    setEditLockedPrice(lp.lockedPrice?.toString() || "");
    setEditProdSearch(lp.productId?.name || "");
    setEditCustSearch(lp.customerId?.name || "");
    setShowEditProdDropdown(false);
    setShowEditCustDropdown(false);
  };

  const cancelInlineEdit = () => {
    setEditingId(null);
    setEditProduct(null);
    setEditCustomer(null);
    setEditLockedPrice("");
    setEditProdSearch("");
    setEditCustSearch("");
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    if (!editCustomer?._id || !editProduct?._id || !editLockedPrice) {
      return toast.warning("Please fill all fields");
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/customer-locked-prices/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: editCustomer._id,
          productId: editProduct._id,
          lockedPrice: Number(editLockedPrice)
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Locked price updated successfully");
        cancelInlineEdit();
        fetchLockedPrices();
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      console.error("Update Error:", err);
      toast.error(err.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("branchId", currentBranch._id);

    setBulkLoading(true);
    try {
      const res = await fetch(`${API_BASE}/customer-locked-prices/bulk-upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchLockedPrices();
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      console.error("Bulk Upload Error:", err);
      toast.error(err.message || "Bulk upload failed");
    } finally {
      setBulkLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleExportExcel = async () => {
    setLoading(true);
    try {
      // Fetch ALL records for this branch without pagination limits (or a very high limit)
      const url = `${API_BASE}/customer-locked-prices/branch/${currentBranch._id}?limit=10000`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      const data = await res.json();
      
      if (!data.success || !data.data || data.data.length === 0) {
        return toast.info("No records to export");
      }

      const allRecords = data.data;
      const exportData = allRecords.map(lp => ({
        "Product Name": lp.productId?.name || "N/A",
        "SKU/Code": lp.productId?.sku || lp.productId?.productCode || "N/A",
        "Customer Name": lp.customerId?.name || "N/A",
        "Current Cost": lp.productId?.purchasingPrice || 0,
        "Std. Selling Price": lp.productId?.sellingPrice || 0,
        "Locked Price": lp.lockedPrice || 0,
        "Margin Amount": (lp.lockedPrice || 0) - (lp.productId?.purchasingPrice || 0),
        "Margin %": lp.productId?.purchasingPrice > 0 
          ? (((lp.lockedPrice - lp.productId.purchasingPrice) / lp.productId.purchasingPrice) * 100).toFixed(2) + "%"
          : "0%"
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Locked Prices");
      XLSX.writeFile(wb, `Locked_Prices_FULL_${currentBranch.name}_${new Date().toLocaleDateString()}.xlsx`);
      toast.success(`Excel exported successfully (${allRecords.length} records)`);
    } catch (err) {
      console.error("Export Error:", err);
      toast.error("Failed to export Excel");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNewRow = async () => {
    if (!newRowData.customerId || !newRowData.productId || !newRowData.lockedPrice) {
      return toast.warn("Please select customer, product, and set a price");
    }

    setSaving(true);
    try {
      const resp = await fetch(`${API_BASE}/customer-locked-prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: currentBranch._id,
          customerId: newRowData.customerId,
          productId: newRowData.productId,
          lockedPrice: Number(newRowData.lockedPrice),
        }),
      });

      const data = await resp.json();
      if (data.success) {
        toast.success("Price locked successfully");
        setIsAdding(false);
        setNewRowData({
          customerId: "",
          customerName: "",
          productId: "",
          productName: "",
          purchasingPrice: 0,
          sellingPrice: 0,
          lockedPrice: "",
          custSearch: "",
          prodSearch: ""
        });
        fetchLockedPrices();
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      toast.error(err.message || "Failed to save locked price");
    } finally {
      setSaving(false);
    }
  };

  // Dropdown options: If searching, use searching state results. Otherwise use initial fetch results.
  const displayCustomers = customers.slice(0, 50);
  const displayProducts = prodSearch.trim() && prodResults.length > 0 ? prodResults : products.slice(0, 50);

  // Auto-calculate margin
  const margin = selectedProduct ? (Number(lockedPrice || selectedProduct.sellingPrice) - selectedProduct.purchasingPrice) : 0;
  const marginPercent = selectedProduct && selectedProduct.purchasingPrice > 0 
    ? (margin / selectedProduct.purchasingPrice) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20">
      <div className="w-full px-3 sm:px-6 py-4">


        {/* HEADER */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 p-3 rounded-lg">
              <FaLock className="text-orange-600 text-xl" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-800 uppercase tracking-tight">Locked Price Records</h1>
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-500 font-semibold tracking-wider uppercase">Customer-Specific Pricing Rules</p>
                <span className="bg-emerald-100 text-emerald-700 text-[9px] font-black px-2 py-0.5 rounded-full border border-emerald-200 uppercase animate-pulse">Dynamic Sync Active</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleBulkUpload} 
              accept=".xlsx, .xls" 
              className="hidden" 
            />
            <button 
              onClick={handleExportExcel}
              className="flex items-center gap-2 text-xs font-black uppercase bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-2 rounded-lg transition shadow-sm"
            >
              <FaFileExcel /> Export Excel
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={bulkLoading}
              className="flex items-center gap-2 text-xs font-black uppercase bg-orange-600 text-white hover:bg-orange-700 px-4 py-2 rounded-lg transition shadow-sm"
            >
              <FaUpload className={bulkLoading ? "animate-spin" : ""} />
              {bulkLoading ? "Processing..." : "Bulk Upload"}
            </button>
            <button 
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 text-xs font-black uppercase bg-[#319bab] text-white hover:bg-[#257f87] px-4 py-2 rounded-lg transition shadow-sm"
            >
              <FaPlus /> Create Lock Price
            </button>
            <button 
              onClick={fetchLockedPrices}
              className="flex items-center gap-2 text-xs font-black uppercase text-[#319bab] hover:bg-[#319bab]/5 px-4 py-2 rounded-lg transition"
            >
              <FaSync className={loading ? "animate-spin" : ""} /> Refresh List
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {/* RECORD LIST (FULL WIDTH) */}
          <div className="w-full">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-full">
              <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Active Locked Prices</span>
                  {selectedIds.length > 0 && (
                    <button 
                      onClick={handleBulkDelete}
                      disabled={bulkDeleting}
                      className="flex items-center gap-2 text-[10px] font-black uppercase bg-red-500 text-white hover:bg-red-600 px-3 py-1.5 rounded-lg transition shadow-sm animate-in fade-in slide-in-from-left-2"
                    >
                      {bulkDeleting ? <FaSync className="animate-spin" /> : <FaTrash />}
                      Delete Selected ({selectedIds.length})
                    </button>
                  )}
                </div>
                <span className="text-[10px] text-[#319bab] font-bold">Showing {lockedPrices.length} records</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-widest border-b border-slate-100">
                      <th className="px-6 py-5 text-center">
                        <input 
                          type="checkbox"
                          checked={lockedPrices.length > 0 && selectedIds.length === lockedPrices.length}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 accent-[#319bab] cursor-pointer"
                        />
                      </th>
                      {isFieldAllowed("productInfo") && (
                        <th 
                          className="px-6 py-5 cursor-pointer hover:bg-slate-100 transition-colors group"
                          onClick={() => handleSort("productName")}
                        >
                          <div className="flex items-center gap-2">
                             Product Info
                             {sortField === "productName" && (sortOrder === 1 ? <FaChevronDown className="rotate-180" /> : <FaChevronDown />)}
                             {!sortField === "productName" && <FaChevronDown className="opacity-0 group-hover:opacity-30" />}
                          </div>
                        </th>
                      )}
                      {isFieldAllowed("customer") && (
                        <th 
                          className="px-6 py-5 cursor-pointer hover:bg-slate-100 transition-colors group"
                          onClick={() => handleSort("customerName")}
                        >
                          <div className="flex items-center gap-2">
                             Customer
                             {sortField === "customerName" && (sortOrder === 1 ? <FaChevronDown className="rotate-180" /> : <FaChevronDown />)}
                          </div>
                        </th>
                      )}
                      {isFieldAllowed("cost") && (
                        <th 
                          className="px-6 py-5 text-right cursor-pointer hover:bg-slate-100 transition-colors group"
                          onClick={() => handleSort("purchasingPrice")}
                        >
                           <div className="flex items-center justify-end gap-2">
                              Cost
                              {sortField === "purchasingPrice" && (sortOrder === 1 ? <FaChevronDown className="rotate-180" /> : <FaChevronDown />)}
                           </div>
                        </th>
                      )}
                      {isFieldAllowed("stdPrice") && (
                        <th 
                          className="px-6 py-5 text-right cursor-pointer hover:bg-slate-100 transition-colors group"
                          onClick={() => handleSort("sellingPrice")}
                        >
                          <div className="flex items-center justify-end gap-2">
                             Std. Price
                             {sortField === "sellingPrice" && (sortOrder === 1 ? <FaChevronDown className="rotate-180" /> : <FaChevronDown />)}
                          </div>
                        </th>
                      )}
                      {isFieldAllowed("lockedPrice") && (
                        <th 
                          className="px-6 py-5 text-right text-orange-600 cursor-pointer hover:bg-slate-100 transition-colors group"
                          onClick={() => handleSort("lockedPrice")}
                        >
                          <div className="flex items-center justify-end gap-2">
                             Locked ₹
                             {sortField === "lockedPrice" && (sortOrder === 1 ? <FaChevronDown className="rotate-180" /> : <FaChevronDown />)}
                          </div>
                        </th>
                      )}
                      {isFieldAllowed("margin") && (
                        <th 
                          className="px-6 py-5 text-right cursor-pointer hover:bg-slate-100 transition-colors group"
                          onClick={() => handleSort("marginPercent")}
                        >
                          <div className="flex items-center justify-end gap-2">
                             Margin %
                             {sortField === "marginPercent" && (sortOrder === 1 ? <FaChevronDown className="rotate-180" /> : <FaChevronDown />)}
                          </div>
                        </th>
                      )}
                      {isFieldAllowed("action") && <th className="px-6 py-5 text-center">Actions</th>}
                    </tr>

                    {/* NEW ROW INLINE */}
                    {isAdding && (
                      <tr className="bg-amber-50/30 border-b-2 border-amber-100 animate-in slide-in-from-top-2">
                        <td className="px-6 py-4 text-center">
                          <FaPlus className="text-amber-500 mx-auto" />
                        </td>
                        <td className="px-4 py-4 relative">
                          <div className="relative">
                            <input 
                              type="text"
                              placeholder="Search Product..."
                              className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-xs font-black"
                              value={newRowData.prodSearch}
                              onChange={(e) => {
                                setNewRowData({ ...newRowData, prodSearch: e.target.value, productId: "" });
                                setShowNewProdDropdown(true);
                              }}
                              onFocus={() => setShowNewProdDropdown(true)}
                            />
                            {showNewProdDropdown && (
                              <div className="absolute top-full left-0 right-0 z-[110] mt-1 bg-white rounded-xl shadow-2xl border border-amber-100 overflow-hidden max-h-60 overflow-y-auto">
                                {newSearchingProd ? (
                                  <div className="p-4 text-center"><FaSync className="animate-spin text-[#319bab] mx-auto" /></div>
                                ) : newProdResults.length > 0 ? newProdResults.map(p => (
                                  <div 
                                    key={p._id} 
                                    className="px-4 py-3 hover:bg-amber-50 cursor-pointer border-b border-slate-50"
                                    onClick={() => {
                                      setNewRowData({ 
                                        ...newRowData, 
                                        productId: p._id, 
                                        productName: p.name, 
                                        prodSearch: p.name,
                                        purchasingPrice: p.purchasingPrice,
                                        sellingPrice: p.sellingPrice 
                                      });
                                      setShowNewProdDropdown(false);
                                    }}
                                  >
                                    <p className="text-xs font-black">{p.name}</p>
                                    <p className="text-[10px] text-slate-400">Cost: ₹{p.purchasingPrice} | Std: ₹{p.sellingPrice}</p>
                                  </div>
                                )) : <div className="p-4 text-center text-xs">No Products Found</div>}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 relative">
                           <div className="relative">
                            <input 
                              type="text"
                              placeholder="Search Customer..."
                              className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-xs font-black"
                              value={newRowData.custSearch}
                              onChange={(e) => {
                                setNewRowData({ ...newRowData, custSearch: e.target.value, customerId: "" });
                                setShowNewCustDropdown(true);
                              }}
                              onFocus={() => setShowNewCustDropdown(true)}
                            />
                            {showNewCustDropdown && (
                              <div className="absolute top-full left-0 right-0 z-[110] mt-1 bg-white rounded-xl shadow-2xl border border-amber-100 overflow-hidden max-h-60 overflow-y-auto">
                                {newSearchingCust ? (
                                  <div className="p-4 text-center"><FaSync className="animate-spin text-[#319bab] mx-auto" /></div>
                                ) : newCustResults.length > 0 ? newCustResults.map(c => (
                                  <div 
                                    key={c._id} 
                                    className="px-4 py-3 hover:bg-amber-50 cursor-pointer border-b border-slate-50"
                                    onClick={() => {
                                      setNewRowData({ 
                                        ...newRowData, 
                                        customerId: c._id, 
                                        customerName: c.name, 
                                        custSearch: c.name 
                                      });
                                      setShowNewCustDropdown(false);
                                    }}
                                  >
                                    <p className="text-xs font-black">{c.name}</p>
                                  </div>
                                )) : <div className="p-4 text-center text-xs">No Customers Found</div>}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right text-xs font-bold text-slate-400">
                          ₹{newRowData.purchasingPrice.toFixed(2)}
                        </td>
                        <td className="px-4 py-4 text-right text-sm font-black text-slate-700">
                          ₹{newRowData.sellingPrice.toFixed(2)}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <input 
                            type="number"
                            placeholder="Price"
                            className="w-24 px-3 py-2 border-2 border-amber-200 rounded-lg text-right font-black text-amber-600 outline-none"
                            value={newRowData.lockedPrice}
                            onChange={(e) => setNewRowData({ ...newRowData, lockedPrice: e.target.value })}
                          />
                        </td>
                        <td className={`px-4 py-4 text-right text-xs font-black ${((Number(newRowData.lockedPrice) - newRowData.purchasingPrice) / (newRowData.purchasingPrice || 1) * 100) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {newRowData.purchasingPrice > 0 
                            ? (((Number(newRowData.lockedPrice) - newRowData.purchasingPrice) / newRowData.purchasingPrice) * 100).toFixed(1)
                            : "0.0"}%
                        </td>
                        <td className="px-4 py-4 text-center">
                           <div className="flex items-center justify-center gap-2">
                             <button onClick={handleSaveNewRow} className="p-2 bg-emerald-500 text-white rounded-lg shadow-sm"><FaPlus size={12} /></button>
                             <button onClick={() => setIsAdding(false)} className="p-2 bg-slate-200 text-slate-600 rounded-lg shadow-sm"><FaTimes size={12} /></button>
                           </div>
                        </td>
                      </tr>
                    )}
                    <tr className="bg-white border-b border-slate-50">
                      <th className="px-4 py-3 bg-slate-50/10"></th>
                      {isFieldAllowed("productInfo") && (
                        <th className="px-4 py-3">
                          <div className="relative">
                            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={12} />
                            <input 
                              type="text"
                              placeholder="Find Product..."
                              value={filters.product}
                              onChange={(e) => setFilters({ ...filters, product: e.target.value })}
                              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold outline-none focus:bg-white focus:border-[#319bab]/40 transition-all"
                            />
                          </div>
                        </th>
                      )}
                      {isFieldAllowed("customer") && (
                        <th className="px-4 py-3">
                          <div className="relative">
                            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={12} />
                            <input 
                              type="text"
                              placeholder="Find Customer..."
                              value={filters.customer}
                              onChange={(e) => setFilters({ ...filters, customer: e.target.value })}
                              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold outline-none focus:bg-white focus:border-[#319bab]/40 transition-all"
                            />
                          </div>
                        </th>
                      )}
                      <th colSpan="5"></th>
                    </tr>
                  </thead>
                   <tbody className="divide-y divide-slate-50">
                    {loading ? (
                      <tr>
                        <td colSpan="8" className="px-6 py-20 text-center">
                          <FaSync className="animate-spin text-[#319bab] mx-auto mb-2" size={32} />
                          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Optimizing Data Stream...</p>
                        </td>
                      </tr>
                    ) : lockedPrices.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="px-6 py-20 text-center">
                          <div className="opacity-20 flex flex-col items-center">
                             <FaSearch size={48} className="mb-3 text-slate-300" />
                             <p className="text-sm font-black uppercase text-slate-400 tracking-tighter">No Locked Records Found</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      lockedPrices.map(lp => {
                        const isEditing = editingId === lp._id;
                        const productName = isEditing ? (editProduct?.name || "") : (lp.productId?.name || "Unknown Product");
                        const customerName = isEditing ? (editCustomer?.name || "") : (lp.customerId?.name || "Unknown Customer");
                        const purchasingPrice = isEditing ? (editProduct?.purchasingPrice || 0) : (lp.productId?.purchasingPrice || 0);
                        const sellingPrice = isEditing ? (editProduct?.sellingPrice || 0) : (lp.productId?.sellingPrice || 0);
                        const currentLockedPrice = isEditing ? Number(editLockedPrice) : (lp.lockedPrice || 0);
                        const mp = purchasingPrice > 0 ? ((currentLockedPrice - purchasingPrice) / purchasingPrice) * 100 : 0;

                        return (
                          <tr key={lp._id} className={`hover:bg-slate-50 transition-colors group ${selectedIds.includes(lp._id) ? 'bg-indigo-50/50' : ''} ${isEditing ? 'bg-amber-50/50' : ''}`}>
                            <td className="px-6 py-5 text-center">
                               <input 
                                 type="checkbox" 
                                 checked={selectedIds.includes(lp._id)}
                                 onChange={() => toggleSelectRow(lp._id)}
                                 className="w-4 h-4 accent-[#319bab] cursor-pointer"
                                 disabled={isEditing}
                                />
                            </td>
                            {isFieldAllowed("productInfo") && (
                              <td className="px-6 py-5 relative">
                                {isEditing ? (
                                  <div className="relative">
                                    <div className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-[#319bab]/20 rounded-lg focus-within:border-[#319bab] transition-all">
                                      <FaBox className="text-slate-400" size={12} />
                                      <input 
                                        type="text"
                                        placeholder="Search Product..."
                                        className="flex-1 bg-transparent border-none outline-none text-xs font-black text-slate-800"
                                        value={editProdSearch}
                                        onChange={(e) => {
                                          setEditProdSearch(e.target.value);
                                          setEditProduct(null);
                                          setShowEditProdDropdown(true);
                                        }}
                                        onFocus={() => setShowEditProdDropdown(true)}
                                      />
                                      {editProduct && <FaCheckCircle className="text-emerald-500" size={12} />}
                                    </div>
                                    
                                    {showEditProdDropdown && (
                                      <div className="absolute top-full left-0 right-0 z-[100] mt-1 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden max-h-60 overflow-y-auto animate-in slide-in-from-top-2 duration-200">
                                        {editSearchingProd ? (
                                          <div className="p-4 text-center"><FaSync className="animate-spin text-[#319bab] mx-auto" /></div>
                                        ) : editProdResults.length > 0 ? (
                                          editProdResults.map(p => (
                                            <div 
                                              key={p._id} 
                                              className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0"
                                              onClick={() => {
                                                setEditProduct(p);
                                                setEditProdSearch(p.name);
                                                setShowEditProdDropdown(false);
                                              }}
                                            >
                                              <p className="text-xs font-black text-slate-800">{p.name}</p>
                                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">₹{p.purchasingPrice} → ₹{p.sellingPrice}</p>
                                            </div>
                                          ))
                                        ) : (
                                          <div className="p-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">No Products Found</div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <>
                                    <div className="font-black text-slate-800 text-sm leading-tight">{productName}</div>
                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-1">Ref: {lp._id.substring(18).toUpperCase()}</div>
                                  </>
                                )}
                              </td>
                            )}
                            {isFieldAllowed("customer") && (
                              <td className="px-6 py-5 relative">
                                {isEditing ? (
                                  <div className="relative">
                                    <div className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-[#319bab]/20 rounded-lg focus-within:border-[#319bab] transition-all">
                                      <FaUser className="text-slate-400" size={12} />
                                      <input 
                                        type="text"
                                        placeholder="Search Customer..."
                                        className="flex-1 bg-transparent border-none outline-none text-xs font-black text-[#319bab]"
                                        value={editCustSearch}
                                        onChange={(e) => {
                                          setEditCustSearch(e.target.value);
                                          setEditCustomer(null);
                                          setShowEditCustDropdown(true);
                                        }}
                                        onFocus={() => setShowEditCustDropdown(true)}
                                      />
                                      {editCustomer && <FaCheckCircle className="text-emerald-500" size={12} />}
                                    </div>

                                    {showEditCustDropdown && (
                                      <div className="absolute top-full left-0 right-0 z-[100] mt-1 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden max-h-60 overflow-y-auto animate-in slide-in-from-top-2 duration-200">
                                        {editSearchingCust ? (
                                          <div className="p-4 text-center"><FaSync className="animate-spin text-[#319bab] mx-auto" /></div>
                                        ) : editCustResults.length > 0 ? (
                                          editCustResults.map(c => (
                                            <div 
                                              key={c._id} 
                                              className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0"
                                              onClick={() => {
                                                setEditCustomer(c);
                                                setEditCustSearch(c.name);
                                                setShowEditCustDropdown(false);
                                              }}
                                            >
                                              <p className="text-xs font-black text-slate-800">{c.name}</p>
                                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{c.whatsapp || c.phone}</p>
                                            </div>
                                          ))
                                        ) : (
                                          <div className="p-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">No Customers Found</div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="font-black text-[#319bab] text-sm">{customerName}</div>
                                )}
                              </td>
                            )}
                            {isFieldAllowed("cost") && (
                              <td className="px-6 py-5 text-right font-bold text-slate-400 text-xs">
                                ₹{purchasingPrice.toFixed(2)}
                              </td>
                            )}
                            {isFieldAllowed("stdPrice") && (
                              <td className="px-6 py-5 text-right font-black text-slate-700 text-sm">
                                ₹{sellingPrice.toFixed(2)}
                              </td>
                            )}
                             {isFieldAllowed("lockedPrice") && (
                              <td className="px-6 py-5 text-right">
                                {isEditing ? (
                                  <input 
                                    type="number"
                                    className="w-24 px-3 py-2 bg-white border-2 border-[#319bab]/40 rounded-lg text-right font-black text-[#319bab] text-sm outline-none shadow-inner"
                                    value={editLockedPrice}
                                    onChange={(e) => setEditLockedPrice(e.target.value)}
                                    autoFocus
                                  />
                                ) : (
                                  <div className="flex flex-col items-end gap-1">
                                    <div className="bg-orange-50 text-orange-700 font-black px-3 py-1.5 rounded-lg border border-orange-100 inline-block text-sm shadow-sm">
                                      ₹{lp.lockedPrice?.toFixed(2)}
                                    </div>
                                    <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-1.5 rounded">Linked to Cost</span>
                                  </div>
                                )}
                              </td>
                            )}
                            {isFieldAllowed("margin") && (
                              <td className={`px-6 py-5 text-right text-sm font-black ${mp >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {mp.toFixed(1)}%
                              </td>
                            )}
                            {isFieldAllowed("action") && (
                              <td className="px-6 py-5 text-center">
                                {isEditing ? (
                                  <div className="flex items-center justify-center gap-2">
                                    <button 
                                      onClick={handleUpdate}
                                      disabled={saving}
                                      className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-all shadow-sm"
                                      title="Save Changes"
                                    >
                                      {saving ? <FaSync className="animate-spin" size={14} /> : <FaCheckCircle size={14} />}
                                    </button>
                                    <button 
                                      onClick={cancelInlineEdit}
                                      className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-all shadow-sm"
                                      title="Cancel"
                                    >
                                      <FaTimes size={14} />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center gap-2">
                                    <button 
                                      onClick={() => startInlineEdit(lp)}
                                      className="text-blue-400 hover:text-blue-600 p-2 transition-all hover:bg-blue-50 rounded-lg"
                                      title="Edit Price"
                                    >
                                      <FaEdit size={14} />
                                    </button>
                                    <button 
                                      onClick={() => handleDelete(lp._id)}
                                      className="text-slate-300 hover:text-red-500 p-2 transition-all hover:bg-red-50 rounded-lg"
                                      title="Delete Record"
                                    >
                                      <FaTrash size={14} />
                                    </button>
                                  </div>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION FOOTER */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                 <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">
                    Total Records: {totalRecords}
                 </div>
                 <div className="flex items-center gap-3">
                    <button 
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                      className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase hover:bg-slate-50 disabled:opacity-50 transition shadow-sm"
                    >
                      Previous
                    </button>
                    <span className="text-xs font-black text-slate-600">PAGE {page} OF {totalPages}</span>
                    <button 
                      disabled={page === totalPages}
                      onClick={() => setPage(page + 1)}
                      className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase hover:bg-slate-50 disabled:opacity-50 transition shadow-sm"
                    >
                      Next
                    </button>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default BranchLockedPrices;
