import React, { useState, useEffect, useCallback, useRef } from "react";
import { FaBoxes, FaPlus, FaTrash, FaCheck, FaSearch, FaTimes, FaHistory, FaChevronDown } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";

// Floating Multi-Select Component (Fixed position to avoid clipping)
const MultiUserSelect = ({ users, selected, onChange, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef(null);

  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top,
        left: rect.left,
        width: rect.width
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener("scroll", updateCoords, true);
      window.addEventListener("resize", updateCoords);
    }
    return () => {
      window.removeEventListener("scroll", updateCoords, true);
      window.removeEventListener("resize", updateCoords);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        const menu = document.getElementById("floating-staff-menu");
        if (menu && menu.contains(event.target)) return;
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = (u) => {
    const uId = u._id || u.id;
    const isSelected = selected.some(s => s.userId === uId);
    let updated;
    if (isSelected) {
      updated = selected.filter(s => s.userId !== uId);
    } else {
      updated = [...selected, { userId: uId, username: u.username || u.fullName }];
    }
    onChange(updated);
  };

  return (
    <div className="relative w-40" ref={containerRef}>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full bg-white border border-gray-300 rounded px-2 py-1.5 text-[11px] flex justify-between items-center cursor-pointer shadow-sm ${disabled ? "bg-gray-100 cursor-not-allowed" : "hover:border-blue-500"}`}
      >
        <span className="truncate font-bold text-gray-700">
          {selected.length === 0 ? "Select Staff" : `${selected.length} Selected`}
        </span>
        <FaChevronDown className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} size={8} />
      </div>

      {isOpen && (
        <div 
          id="floating-staff-menu"
          style={{ 
            position: "fixed", 
            top: coords.top + 32,
            left: coords.left,
            width: Math.max(coords.width, 220),
            zIndex: 99999
          }}
          className="bg-white border-2 border-blue-600 shadow-[0_20px_50px_rgba(0,0,0,0.4)] rounded-md overflow-hidden animate-in fade-in zoom-in duration-200"
        >
          <div className="max-h-64 overflow-y-auto p-1 bg-white">
            {users.length === 0 ? (
              <div className="p-4 text-center text-[10px] text-gray-400 font-black uppercase italic">No staff found</div>
            ) : (
              users.map(u => {
                const uId = u._id || u.id;
                const isChecked = selected.some(s => s.userId === uId);
                return (
                  <div 
                    key={uId} 
                    onClick={() => handleToggle(u)}
                    className={`flex items-center px-3 py-2.5 rounded mb-0.5 cursor-pointer transition-all ${isChecked ? "bg-blue-600 text-white shadow-inner" : "hover:bg-blue-50 text-gray-700"}`}
                  >
                    <div className={`w-4 h-4 border rounded flex items-center justify-center mr-3 ${isChecked ? "bg-white border-white" : "bg-white border-gray-300"}`}>
                      {isChecked && <FaCheck className="text-blue-600" size={10} />}
                    </div>
                    <span className="text-[11px] font-black uppercase truncate">{u.username || u.fullName}</span>
                  </div>
                );
              })
            )}
          </div>
          <div className="bg-gray-50 p-2 border-t border-gray-200 flex justify-between items-center">
            <button onClick={() => onChange([])} className="text-[10px] font-black text-red-500 uppercase hover:underline">Clear All</button>
            <button onClick={() => setIsOpen(false)} className="px-4 py-1.5 bg-blue-600 text-white text-[10px] font-black rounded uppercase shadow hover:bg-blue-700">Done</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default function BranchPhysicalStock() {
  const { currentBranch, user } = useBranch();

  const [productGroups, setProductGroups] = useState([]);
  const [products, setProducts] = useState([]);
  const [branchUsers, setBranchUsers] = useState([]);
  const [nextId, setNextId] = useState("SJ001");
  const [rows, setRows] = useState([]);
  const [groupFilter, setGroupFilter] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [showProductDrop, setShowProductDrop] = useState(false);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);
  const [expandedMobileRows, setExpandedMobileRows] = useState({});
  const [mobileViewMode, setMobileViewMode] = useState("TABLE"); // "TABLE" or "CARD"

  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const isFieldVisible = (fieldId) => {
    if (!user) return false;
    // Super Admin is the master override - always see everything
    if (user.role === "SUPER_ADMIN") return true;

    const key = `physical-stock-entry_${fieldId}`;
    // For all other users, if explicitly disabled in Control System, hide it
    if (user.fieldPermissions?.[key] === false) return false;
    // If explicitly enabled, show it
    if (user.fieldPermissions?.[key] === true) return true;
    
    // Default for regular ADMIN: show unless explicitly disabled above
    if (user.role === "ADMIN") return true;
    
    // For other roles, hide unless explicitly enabled
    return false;
  };

  useEffect(() => {
    if (currentBranch?._id) {
      fetchMeta();
      fetchNextId();
    }
  }, [currentBranch?._id]);

  const fetchNextId = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/physical-stock/next-id?branchId=${currentBranch._id}`);
      const data = await res.json();
      if (data.success) setNextId(data.nextId);
    } catch {}
  };

  const fetchMeta = async () => {
    try {
      const [grRes, userRes] = await Promise.all([
        fetchWithAuth(`${API_BASE}/product-groups?branchId=${currentBranch._id}`),
        fetchWithAuth(`${API_BASE}/branch-users/branch/${currentBranch._id}`)
      ]);
      const grData = await grRes.json();
      const uData = await userRes.json();
      
      if (Array.isArray(grData)) setProductGroups(grData);
      else if (grData.success) setProductGroups(grData.data || []);

      if (uData.success) setBranchUsers(uData.data || []);
      else if (Array.isArray(uData)) setBranchUsers(uData);
    } catch {}
  };

  const searchProducts = useCallback(async (query, groupId) => {
    if (!currentBranch?._id) return;
    try {
      const url = `${API_BASE}/products?branchId=${currentBranch._id}&search=${query}&limit=20${groupId && groupId !== "ALL" ? `&productGroup=${groupId}` : ""}`;
      const res = await fetchWithAuth(url);
      const data = await res.json();
      if (data.success) setProducts(data.data || []);
    } catch {}
  }, [currentBranch?._id]);

  useEffect(() => {
    const t = setTimeout(() => {
      // Fetch even if search is empty to show initial list
      searchProducts(productSearch, groupFilter);
      if (productSearch.length >= 0) {
        setShowProductDrop(true);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [productSearch, groupFilter]);

  const addRow = async (product) => {
    setShowProductDrop(false);
    setProductSearch("");

    let systemQty = 0;
    try {
      const res = await fetchWithAuth(`${API_BASE}/products?branchId=${currentBranch._id}&search=${encodeURIComponent(product.name)}&limit=5`);
      const data = await res.json();
      const match = (data.data || []).find(p => p._id === product._id);
      systemQty = match?.availableQty ?? product.availableQty ?? 0;
    } catch {}

    const rowId = `row_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setRows(prev => [...prev, {
      rowId,
      productId: product._id,
      productName: product.name,
      productGroupId: product.productGroup?._id || "",
      productGroupName: product.productGroup?.name || "",
      systemQty,
      physicalQty: "",
      mrp: product.mrp || 0,
      batch: "",
      expiryDate: "",
      checkedBy: [],
      saving: false,
      savedId: null,
      status: "DRAFT"
    }]);
  };

  const updateRow = (rowId, field, value) => {
    setRows(prev => prev.map(r => r.rowId !== rowId ? r : { ...r, [field]: value }));
  };

  const removeRow = (rowId) => {
    // Keeping for internal logic if needed, but removed from UI as requested
    setRows(prev => prev.filter(r => r.rowId !== rowId));
  };

  const calc = (row) => {
    if (row.physicalQty === "" || row.physicalQty === null) return { inward: 0, outward: 0 };
    const p = Number(row.physicalQty) || 0;
    const s = Number(row.systemQty) || 0;
    return {
      inward: p > s ? Number((p - s).toFixed(4)) : 0,
      outward: s > p ? Number((s - p).toFixed(4)) : 0
    };
  };

  const saveRow = async (row) => {
    if (row.physicalQty === "" || row.physicalQty === null) return toast.warning("Physical Qty is mandatory");
    if (!row.mrp || Number(row.mrp) <= 0) return toast.warning("Valid MRP is mandatory");
    if (!row.batch || row.batch.trim() === "") return toast.warning("Batch Number is mandatory");
    if (!row.expiryDate) return toast.warning("Expiry Date is mandatory");
    if (!row.checkedBy || row.checkedBy.length === 0) return toast.warning("At least one Staff Member must be selected");
    setRows(prev => prev.map(r => r.rowId === row.rowId ? { ...r, saving: true } : r));
    try {
      const payload = {
        branchId: currentBranch._id,
        productGroupId: row.productGroupId || undefined,
        productGroupName: row.productGroupName || "",
        productId: row.productId,
        productName: row.productName,
        systemQty: Number(row.systemQty),
        physicalQty: Number(row.physicalQty),
        mrp: Number(row.mrp) || 0,
        batch: row.batch,
        expiryDate: row.expiryDate || undefined,
        checkedBy: row.checkedBy,
        userId: user?._id || user?.id,
        username: user?.username || user?.fullName || "Staff"
      };

      let res, data;
      if (row.savedId) {
        res = await fetchWithAuth(`${API_BASE}/physical-stock/${row.savedId}`, {
          method: "PUT", body: JSON.stringify(payload)
        });
      } else {
        res = await fetchWithAuth(`${API_BASE}/physical-stock`, {
          method: "POST", body: JSON.stringify(payload)
        });
      }
      data = await res.json();
      if (data.success) {
        setRows(prev => prev.map(r => r.rowId === row.rowId ? {
          ...r, saving: false, savedId: data.data._id, status: "PENDING"
        } : r));
        if (!row.savedId) fetchNextId();
        toast.success(`${data.data.sjId} saved`);
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      toast.error(err.message || "Save failed");
      setRows(prev => prev.map(r => r.rowId === row.rowId ? { ...r, saving: false } : r));
    }
  };

  const approveRow = async (row) => {
    if (!row.savedId) return toast.warning("Save first");
    if (!isAdmin && !isFieldVisible("action_approve")) return toast.error("No permission to approve");
    setRows(prev => prev.map(r => r.rowId === row.rowId ? { ...r, saving: true } : r));
    try {
      const res = await fetchWithAuth(`${API_BASE}/physical-stock/${row.savedId}/approve`, {
        method: "POST",
        body: JSON.stringify({ userId: user?._id || user?.id, username: user?.username || user?.fullName, role: user?.role })
      });
      const data = await res.json();
      if (data.success) {
        setRows(prev => prev.map(r => r.rowId === row.rowId ? { ...r, saving: false, status: "APPROVED" } : r));
        toast.success(data.message);
      } else throw new Error(data.message);
    } catch (err) {
      toast.error(err.message || "Approval failed");
      setRows(prev => prev.map(r => r.rowId === row.rowId ? { ...r, saving: false } : r));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-16 md:pl-20">
      <div className="p-4">
        
        <div className="bg-white border border-gray-300 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 rounded-xl shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#001f3f] flex items-center justify-center rounded-xl shadow-inner">
              <FaBoxes className="text-white text-lg" />
            </div>
            <div>
              <h1 className="text-lg font-black text-gray-800 uppercase tracking-tight leading-tight">Stock Journal Entry</h1>
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                Next: <span className="text-blue-600">{nextId}</span> - {currentBranch?.name}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:flex items-center gap-2">
            <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)}
              className="border border-gray-300 px-3 py-2 text-[11px] font-black rounded-xl outline-none bg-gray-50 text-gray-700 w-full" />
            <a href="/branch/physical-stock-records"
              className="px-3 py-2 bg-gray-800 text-white text-[11px] font-black rounded-xl hover:bg-gray-900 transition uppercase flex items-center justify-center gap-2 w-full shadow-lg shadow-gray-200">
              <FaHistory /> Records
            </a>
          </div>
        </div>

        {/* COMPACT SEARCH */}
        <div className="bg-white border border-gray-300 p-3 mb-4 flex flex-col md:flex-row gap-3 items-center rounded-xl shadow-sm">
          <select className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-[11px] font-black text-gray-700 outline-none w-full md:w-64"
            value={groupFilter} onChange={e => { setGroupFilter(e.target.value); setProductSearch(""); }}>
            <option value="">ALL GROUPS</option>
            {productGroups.map(g => <option key={g._id} value={g._id}>{g.name.toUpperCase()}</option>)}
          </select>
          <div className="flex-1 relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
            <input type="text" placeholder="Search and add product..."
              value={productSearch} 
              onChange={e => setProductSearch(e.target.value)}
              onFocus={() => {
                searchProducts("", groupFilter);
                setShowProductDrop(true);
              }}
              className="w-full border border-gray-300 rounded pl-9 pr-3 py-1.5 text-xs font-semibold outline-none focus:border-blue-400" />
            {showProductDrop && products.length > 0 && (
              <div className="absolute z-[100] left-0 right-0 top-full mt-1 bg-white border border-gray-300 shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
                {products.map(p => (
                  <div key={p._id} onClick={() => addRow(p)}
                    className="px-3 py-2.5 hover:bg-blue-50 cursor-pointer border-b last:border-0 flex justify-between items-center">
                    <div>
                      <p className="text-[11px] font-bold text-gray-800 uppercase">{p.name}</p>
                      <p className="text-[9px] text-gray-400 font-bold uppercase">{p.productGroup?.name || "No Group"}</p>
                    </div>
                    <span className="text-[10px] font-black bg-blue-50 text-blue-700 px-2 py-1 rounded">
                      Stock: {p.availableQty ?? 0}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* DESKTOP TABLE */}
          <div className="hidden md:block bg-white border border-gray-300 shadow-sm overflow-visible rounded-xl">
            <div className="overflow-x-auto overflow-y-visible">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-1.5 py-4 border-r border-gray-200 font-black text-[9px] uppercase tracking-widest text-gray-400 whitespace-nowrap">#</th>
                    {isFieldVisible("productName") && <th className="px-1.5 py-4 border-r border-gray-200 font-black text-[9px] uppercase tracking-widest text-gray-400 whitespace-nowrap">Product</th>}
                    {isFieldVisible("productGroupName") && <th className="px-1.5 py-4 border-r border-gray-200 font-black text-[9px] uppercase tracking-widest text-gray-400 whitespace-nowrap">Group</th>}
                    {isFieldVisible("systemQty") && <th className="px-1.5 py-4 border-r border-gray-200 font-black text-[9px] uppercase tracking-widest text-gray-400 whitespace-nowrap">System</th>}
                    {isFieldVisible("physicalQty") && <th className="px-1.5 py-4 border-r border-gray-200 font-black text-[9px] uppercase tracking-widest text-gray-400 whitespace-nowrap">Physical</th>}
                    {isFieldVisible("inward") && <th className="px-1.5 py-4 border-r border-gray-200 font-black text-[9px] uppercase tracking-widest text-gray-400 whitespace-nowrap">Inward</th>}
                    {isFieldVisible("outward") && <th className="px-1.5 py-4 border-r border-gray-200 font-black text-[9px] uppercase tracking-widest text-gray-400 whitespace-nowrap">Outward</th>}
                    {isFieldVisible("mrp") && <th className="px-1.5 py-4 border-r border-gray-200 font-black text-[9px] uppercase tracking-widest text-gray-400 whitespace-nowrap">MRP</th>}
                    {isFieldVisible("batch") && <th className="px-1.5 py-4 border-r border-gray-200 font-black text-[9px] uppercase tracking-widest text-gray-400 whitespace-nowrap">Batch</th>}
                    {isFieldVisible("expiryDate") && <th className="px-1.5 py-4 border-r border-gray-200 font-black text-[9px] uppercase tracking-widest text-gray-400 whitespace-nowrap">Expiry</th>}
                    {isFieldVisible("checkedBy") && <th className="px-1.5 py-4 border-r border-gray-200 font-black text-[9px] uppercase tracking-widest text-gray-400 whitespace-nowrap">Staff</th>}
                    {isFieldVisible("status") && <th className="px-1.5 py-4 border-r border-gray-200 font-black text-[9px] uppercase tracking-widest text-gray-400 whitespace-nowrap">Status</th>}
                    <th className="px-1.5 py-4 font-black text-[9px] uppercase tracking-widest text-gray-400 whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan="12" className="py-20 text-center text-gray-300 font-black uppercase text-[11px] tracking-widest">
                        Search and add products to start
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, idx) => {
                      const { inward, outward } = calc(row);
                      return (
                        <tr key={row.rowId} className={`hover:bg-gray-50 transition-colors ${row.status === "APPROVED" ? "bg-green-50" : ""}`}>
                          <td className="px-1.5 py-3 border-r border-gray-100 font-black text-gray-300 text-center">{idx + 1}</td>
                          {isFieldVisible("productName") && (
                            <td className="px-1.5 py-3 border-r border-gray-100">
                              <p className="font-black text-gray-700 text-[10px] uppercase truncate max-w-[160px]">{row.productName}</p>
                            </td>
                          )}
                          {isFieldVisible("productGroupName") && <td className="px-1.5 py-3 border-r border-gray-100 text-[9px] text-gray-400 font-black uppercase">{row.productGroupName || "-"}</td>}
                          {isFieldVisible("systemQty") && <td className="px-1.5 py-3 border-r border-gray-100 text-center font-black text-[10px] text-blue-500">{row.systemQty}</td>}
                          {isFieldVisible("physicalQty") && (
                            <td className="px-1.5 py-3 border-r border-gray-100">
                              <input type="number" min="0"
                                value={row.physicalQty}
                                onChange={e => updateRow(row.rowId, "physicalQty", e.target.value)}
                                disabled={row.status === "APPROVED"}
                                className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-[11px] font-black outline-none focus:border-blue-400 disabled:bg-gray-50 shadow-sm"
                                placeholder="Qty" />
                            </td>
                          )}
                          {isFieldVisible("inward") && (
                            <td className="px-1.5 py-3 border-r border-gray-100 text-center">
                              {inward > 0 ? <span className="text-green-600 font-black text-[10px] bg-green-50 px-1.5 py-0.5 rounded">+{inward}</span> : ""}
                            </td>
                          )}
                          {isFieldVisible("outward") && (
                            <td className="px-1.5 py-3 border-r border-gray-100 text-center">
                              {outward > 0 ? <span className="text-red-500 font-black text-[10px] bg-red-50 px-1.5 py-0.5 rounded">-{outward}</span> : ""}
                            </td>
                          )}
                          {isFieldVisible("mrp") && (
                            <td className="px-1.5 py-3 border-r border-gray-100">
                              <input type="number" value={row.mrp}
                                onChange={e => updateRow(row.rowId, "mrp", e.target.value)}
                                disabled={row.status === "APPROVED"}
                                className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-[10px] font-black outline-none focus:border-blue-400 disabled:bg-gray-50"
                                placeholder="MRP" />
                            </td>
                          )}
                          {isFieldVisible("batch") && (
                            <td className="px-1.5 py-3 border-r border-gray-100">
                              <input type="text" value={row.batch}
                                onChange={e => updateRow(row.rowId, "batch", e.target.value)}
                                disabled={row.status === "APPROVED"}
                                className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-[10px] font-black outline-none disabled:bg-gray-50"
                                placeholder="Batch" />
                            </td>
                          )}
                          {isFieldVisible("expiryDate") && (
                            <td className="px-1.5 py-3 border-r border-gray-100">
                              <input type="date" value={row.expiryDate}
                                onChange={e => updateRow(row.rowId, "expiryDate", e.target.value)}
                                disabled={row.status === "APPROVED"}
                                className="w-28 border border-gray-200 rounded-lg px-2 py-1.5 text-[9px] font-black outline-none disabled:bg-gray-50" />
                            </td>
                          )}
                          {isFieldVisible("checkedBy") && (
                            <td className="px-1.5 py-3 border-r border-gray-100">
                              <MultiUserSelect
                                users={branchUsers}
                                selected={row.checkedBy}
                                onChange={(val) => updateRow(row.rowId, "checkedBy", val)}
                                disabled={row.status === "APPROVED"}
                              />
                            </td>
                          )}
                          {isFieldVisible("status") && (
                            <td className="px-1.5 py-3 border-r border-gray-100 text-center">
                              {row.status === "APPROVED"
                                ? <span className="text-green-600 font-black text-[9px] uppercase bg-green-50 px-2 py-1 rounded-full whitespace-nowrap">Approved</span>
                                : row.savedId 
                                  ? <span className="text-blue-500 font-black text-[9px] uppercase bg-blue-50 px-2 py-1 rounded-full whitespace-nowrap">Pending</span>
                                  : <span className="text-orange-500 font-black text-[9px] uppercase bg-orange-50 px-2 py-1 rounded-full whitespace-nowrap">Draft</span>}
                            </td>
                          )}
                          <td className="px-1.5 py-3">
                            <div className="flex items-center gap-1 justify-center">
                              {row.status !== "APPROVED" && (
                                <>
                                  {isFieldVisible("action_save") && (
                                    <button onClick={() => saveRow(row)} disabled={row.saving}
                                      className="px-3 py-1.5 bg-blue-600 text-white text-[9px] font-black rounded-lg hover:bg-blue-700 disabled:opacity-50 uppercase shadow-md shadow-blue-100">
                                      {row.saving ? "..." : "Save"}
                                    </button>
                                  )}
                                  {isAdmin || isFieldVisible("action_approve") ? (
                                    row.savedId && (
                                      <button onClick={() => approveRow(row)} disabled={row.saving}
                                        className="px-3 py-1.5 bg-emerald-600 text-white text-[9px] font-black rounded-lg hover:bg-emerald-700 disabled:opacity-50 uppercase shadow-md shadow-emerald-100">
                                        Approve
                                      </button>
                                    )
                                  ) : null}
                                </>
                              )}
                              {row.status === "APPROVED" && (
                                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                  <FaCheck size={12} />
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* MOBILE VIEW TOGGLE & CONTENT */}
          <div className="md:hidden space-y-4">
            <div className="flex bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
              <button 
                type="button"
                onClick={() => setMobileViewMode("TABLE")}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${mobileViewMode === "TABLE" ? "bg-[#001f3f] text-white shadow-lg" : "text-gray-400 hover:bg-gray-50"}`}>
                Table
              </button>
              <button 
                type="button"
                onClick={() => setMobileViewMode("CARD")}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${mobileViewMode === "CARD" ? "bg-[#001f3f] text-white shadow-lg" : "text-gray-400 hover:bg-gray-50"}`}>
                Cards
              </button>
            </div>

            {rows.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-dashed border-gray-300 text-center">
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Search products above to start</p>
              </div>
            ) : (
              <>
                {mobileViewMode === "TABLE" ? (
                  <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[500px]">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            {isFieldVisible("productName") && <th className="px-3 py-3 font-black text-[9px] uppercase tracking-widest text-gray-400 border-r">Product</th>}
                            {isFieldVisible("systemQty") && <th className="px-3 py-3 font-black text-[9px] uppercase tracking-widest text-gray-400 border-r">Sys</th>}
                            {isFieldVisible("physicalQty") && <th className="px-3 py-3 font-black text-[9px] uppercase tracking-widest text-gray-400 border-r">Phy</th>}
                            {(isFieldVisible("inward") || isFieldVisible("outward")) && <th className="px-3 py-3 font-black text-[9px] uppercase tracking-widest text-gray-400 border-r">Diff</th>}
                            {isFieldVisible("mrp") && <th className="px-3 py-3 font-black text-[9px] uppercase tracking-widest text-gray-400 border-r">MRP</th>}
                            <th className="px-3 py-3 font-black text-[9px] uppercase tracking-widest text-gray-400"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {rows.map((row) => {
                            const { inward, outward } = calc(row);
                            return (
                              <React.Fragment key={row.rowId}>
                                <tr className={`hover:bg-gray-50 transition-colors ${row.status === "APPROVED" ? "bg-green-50" : ""}`}>
                                  {isFieldVisible("productName") && (
                                    <td className="px-3 py-3 border-r border-gray-100 min-w-[140px]">
                                      <p className="font-black text-gray-700 text-[10px] uppercase leading-tight truncate">{row.productName}</p>
                                      <p className="text-[8px] font-bold text-gray-400 uppercase">{row.productGroupName || "-"}</p>
                                    </td>
                                  )}
                                  {isFieldVisible("systemQty") && <td className="px-3 py-3 border-r border-gray-100 text-center font-black text-[10px] text-blue-500">{row.systemQty}</td>}
                                  {isFieldVisible("physicalQty") && (
                                    <td className="px-3 py-3 border-r border-gray-100">
                                      <input type="number" value={row.physicalQty} onChange={e => updateRow(row.rowId, "physicalQty", e.target.value)}
                                        disabled={row.status === "APPROVED"}
                                        className="w-16 border border-gray-200 rounded px-2 py-1 text-[10px] font-black outline-none focus:border-blue-400" />
                                    </td>
                                  )}
                                  {(isFieldVisible("inward") || isFieldVisible("outward")) && (
                                    <td className="px-3 py-3 border-r border-gray-100 text-center">
                                      {isFieldVisible("inward") && inward > 0 && <span className="text-green-600 font-black text-[9px]">+{inward}</span>}
                                      {isFieldVisible("outward") && outward > 0 && <span className="text-red-500 font-black text-[9px]">-{outward}</span>}
                                    </td>
                                  )}
                                  {isFieldVisible("mrp") && (
                                    <td className="px-3 py-3 border-r border-gray-100">
                                      <input type="number" value={row.mrp} onChange={e => updateRow(row.rowId, "mrp", e.target.value)}
                                        disabled={row.status === "APPROVED"}
                                        className="w-12 border border-gray-200 rounded px-1 py-1 text-[9px] font-black outline-none focus:border-blue-400" placeholder="MRP" />
                                    </td>
                                  )}
                                  <td className="px-3 py-3">
                                    <button 
                                      type="button"
                                      onClick={() => setExpandedMobileRows(prev => ({ ...prev, [row.rowId]: !prev[row.rowId] }))}
                                      className="w-8 h-8 flex items-center justify-center bg-gray-50 rounded-lg text-gray-400"
                                    >
                                      <FaChevronDown size={10} className={`transition-transform ${expandedMobileRows[row.rowId] ? "rotate-180" : ""}`} />
                                    </button>
                                  </td>
                                </tr>
                                {expandedMobileRows[row.rowId] && (
                                  <tr className="bg-gray-50">
                                    <td colSpan="6" className="px-3 py-4 border-b border-gray-200">
                                      <div className="space-y-4">
                                      <div className="grid grid-cols-2 gap-3 bg-white p-2 rounded-xl border border-gray-100">
                                          {isFieldVisible("inward") && (
                                            <div className="flex justify-between items-center px-2">
                                              <p className="text-[8px] font-black text-emerald-600 uppercase">Inward Adjust</p>
                                              <p className="text-[10px] font-black text-emerald-700">{inward > 0 ? `+${inward}` : ""}</p>
                                            </div>
                                          )}
                                          {isFieldVisible("outward") && (
                                            <div className={`flex justify-between items-center px-2 ${isFieldVisible("inward") ? "border-l border-gray-100" : ""}`}>
                                              <p className="text-[8px] font-black text-rose-600 uppercase">Outward Adjust</p>
                                              <p className="text-[10px] font-black text-rose-700">{outward > 0 ? `-${outward}` : ""}</p>
                                            </div>
                                          )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                          {isFieldVisible("batch") && (
                                            <div>
                                              <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Batch Number</p>
                                              <input type="text" value={row.batch} onChange={e => updateRow(row.rowId, "batch", e.target.value)}
                                                disabled={row.status === "APPROVED"}
                                                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-[10px] font-black outline-none" placeholder="Batch" />
                                            </div>
                                          )}
                                          {isFieldVisible("expiryDate") && (
                                            <div>
                                              <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Expiry Date</p>
                                              <input type="date" value={row.expiryDate} onChange={e => updateRow(row.rowId, "expiryDate", e.target.value)}
                                                disabled={row.status === "APPROVED"}
                                                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-[9px] font-black outline-none" />
                                            </div>
                                          )}
                                          {isFieldVisible("checkedBy") && (
                                            <div className="col-span-2">
                                              <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Staff Member</p>
                                              <MultiUserSelect users={branchUsers} selected={row.checkedBy} onChange={(val) => updateRow(row.rowId, "checkedBy", val)} disabled={row.status === "APPROVED"} />
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                                          <div className="flex items-center gap-2">
                                            {isFieldVisible("status") && (
                                              row.status === "APPROVED" ? (
                                                <span className="text-[8px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-full uppercase flex items-center gap-1">
                                                  <FaCheck size={8} /> Approved
                                                </span>
                                              ) : row.savedId ? (
                                                <span className="text-[8px] font-black text-blue-500 bg-blue-50 px-2 py-1 rounded-full uppercase">Pending Approval</span>
                                              ) : (
                                                <span className="text-[8px] font-black text-orange-500 bg-orange-50 px-2 py-1 rounded-full uppercase">Draft Mode</span>
                                              )
                                            )}
                                          </div>
                                          <div className="flex gap-2">
                                            {row.status !== "APPROVED" && (
                                              <>
                                                {isFieldVisible("action_save") && (
                                                  <button type="button" onClick={() => saveRow(row)} disabled={row.saving} className="px-4 py-1.5 bg-[#001f3f] text-white text-[10px] font-black rounded-lg uppercase shadow-lg">
                                                    {row.saving ? "..." : "Save Record"}
                                                  </button>
                                                )}
                                                {(isAdmin || isFieldVisible("action_approve")) && row.savedId && (
                                                  <button type="button" onClick={() => approveRow(row)} disabled={row.saving} className="px-4 py-1.5 bg-emerald-600 text-white text-[10px] font-black rounded-lg uppercase shadow-lg">
                                                    Approve
                                                  </button>
                                                )}
                                              </>
                                            )}
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
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {rows.map(row => {
                      const { inward, outward } = calc(row);
                      return (
                        <div key={row.rowId} className={`bg-white p-4 rounded-2xl shadow-sm border ${row.status === "APPROVED" ? "border-green-200 bg-green-50" : "border-gray-200"}`}>
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex-1">
                              {isFieldVisible("productName") && (
                                <>
                                  <h4 className="font-black text-gray-800 text-[11px] uppercase leading-tight">{row.productName}</h4>
                                  <p className="text-[8px] font-bold text-gray-400 uppercase mt-0.5">{row.productGroupName || "-"}</p>
                                </>
                              )}
                            </div>
                            <div className="text-right">
                              {isFieldVisible("status") && (
                                row.status === "APPROVED" ? (
                                  <span className="text-[8px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-full uppercase">Approved</span>
                                ) : row.savedId ? (
                                  <span className="text-[8px] font-black text-blue-500 bg-blue-50 px-2 py-1 rounded-full uppercase">Pending</span>
                                ) : (
                                  <span className="text-[8px] font-black text-orange-500 bg-orange-50 px-2 py-1 rounded-full uppercase">Draft</span>
                                )
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-3 mb-4">
                            {isFieldVisible("systemQty") && (
                              <div className="bg-blue-50 p-2 rounded-xl">
                                <p className="text-[8px] font-black text-blue-400 uppercase mb-1">System</p>
                                <p className="text-xs font-black text-blue-600">{row.systemQty}</p>
                              </div>
                            )}
                            {isFieldVisible("physicalQty") && (
                              <div className="bg-gray-50 p-2 rounded-xl">
                                <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Physical</p>
                                <input type="number" value={row.physicalQty} onChange={e => updateRow(row.rowId, "physicalQty", e.target.value)}
                                  disabled={row.status === "APPROVED"}
                                  className="w-full bg-transparent text-xs font-black text-gray-800 outline-none" placeholder="0" />
                              </div>
                            )}
                            {isFieldVisible("mrp") && (
                              <div className="bg-gray-50 p-2 rounded-xl">
                                <p className="text-[8px] font-black text-gray-400 uppercase mb-1">MRP</p>
                                <input type="number" value={row.mrp} onChange={e => updateRow(row.rowId, "mrp", e.target.value)}
                                  disabled={row.status === "APPROVED"}
                                  className="w-full bg-transparent text-xs font-black text-blue-600 outline-none" placeholder="0" />
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-3 mb-4">
                            {isFieldVisible("inward") && (
                              <div className="bg-emerald-50 p-2 rounded-xl flex justify-between items-center">
                                <p className="text-[8px] font-black text-emerald-600 uppercase">Inward</p>
                                <p className="text-[10px] font-black text-emerald-700">{inward > 0 ? `+${inward}` : ""}</p>
                              </div>
                            )}
                            {isFieldVisible("outward") && (
                              <div className="bg-rose-50 p-2 rounded-xl flex justify-between items-center">
                                <p className="text-[8px] font-black text-rose-600 uppercase">Outward</p>
                                <p className="text-[10px] font-black text-rose-700">{outward > 0 ? `-${outward}` : ""}</p>
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-3 mb-4">
                            {isFieldVisible("batch") && (
                              <div>
                                <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Batch</p>
                                <input type="text" value={row.batch} onChange={e => updateRow(row.rowId, "batch", e.target.value)}
                                  disabled={row.status === "APPROVED"}
                                  className="w-full border border-gray-100 rounded-lg px-2 py-1.5 text-[10px] font-black outline-none" placeholder="Batch" />
                              </div>
                            )}
                            {isFieldVisible("expiryDate") && (
                              <div>
                                <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Expiry</p>
                                <input type="date" value={row.expiryDate} onChange={e => updateRow(row.rowId, "expiryDate", e.target.value)}
                                  disabled={row.status === "APPROVED"}
                                  className="w-full border border-gray-100 rounded-lg px-2 py-1.5 text-[9px] font-black outline-none" />
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                            {isFieldVisible("checkedBy") ? (
                              <MultiUserSelect users={branchUsers} selected={row.checkedBy} onChange={(val) => updateRow(row.rowId, "checkedBy", val)} disabled={row.status === "APPROVED"} />
                            ) : <div />}
                            {row.status !== "APPROVED" && isFieldVisible("action_save") && (
                              <button type="button" onClick={() => saveRow(row)} disabled={row.saving} className="px-6 py-2 bg-[#001f3f] text-white text-[10px] font-black rounded-xl uppercase shadow-lg active:scale-95 transition-all">
                                {row.saving ? "..." : "Save Record"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
