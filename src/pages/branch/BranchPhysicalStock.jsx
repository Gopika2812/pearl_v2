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

  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

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
      if (productSearch.length >= 1) {
        searchProducts(productSearch, groupFilter);
        setShowProductDrop(true);
      } else {
        setShowProductDrop(false);
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
    setRows(prev => prev.filter(r => r.rowId !== rowId));
  };

  const calc = (row) => {
    const p = Number(row.physicalQty) || 0;
    const s = Number(row.systemQty) || 0;
    return {
      inward: p > s ? +(p - s).toFixed(4) : 0,
      outward: s > p ? +(s - p).toFixed(4) : 0
    };
  };

  const saveRow = async (row) => {
    if (row.physicalQty === "" || row.physicalQty === null) {
      return toast.warning("Enter physical qty first");
    }
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
          ...r, saving: false, savedId: data.data._id, status: "DRAFT"
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
    if (!isAdmin) return toast.error("Only ADMIN can approve");
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
        
        {/* COMPACT HEADER */}
        <div className="bg-white border border-gray-300 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 rounded-xl shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#001f3f] flex items-center justify-center rounded-xl shadow-inner">
              <FaBoxes className="text-white text-lg" />
            </div>
            <div>
              <h1 className="text-lg font-black text-gray-800 uppercase tracking-tight leading-tight">Stock Journal Entry</h1>
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                Next: <span className="text-blue-600">{nextId}</span> • {currentBranch?.name}
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
              value={productSearch} onChange={e => setProductSearch(e.target.value)}
              onFocus={() => productSearch && setShowProductDrop(true)}
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
                    {["#", "Product", "Group", "System", "Physical", "Inward", "Outward", "MRP", "Batch", "Expiry", "Staff", "Status", "Actions"].map(h => (
                      <th key={h} className="px-3 py-4 border-r border-gray-200 last:border-0 font-black text-[9px] uppercase tracking-widest text-gray-400 whitespace-nowrap">{h}</th>
                    ))}
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
                        <tr key={row.rowId} className={`hover:bg-gray-50/50 transition-colors ${row.status === "APPROVED" ? "bg-green-50/30" : ""}`}>
                          <td className="px-3 py-3 border-r border-gray-100 font-black text-gray-300 text-center">{idx + 1}</td>
                          <td className="px-3 py-3 border-r border-gray-100">
                            <p className="font-black text-gray-700 text-[10px] uppercase truncate max-w-[160px]">{row.productName}</p>
                          </td>
                          <td className="px-3 py-3 border-r border-gray-100 text-[9px] text-gray-400 font-black uppercase">{row.productGroupName || "-"}</td>
                          <td className="px-3 py-3 border-r border-gray-100 text-center font-black text-[10px] text-blue-500">{row.systemQty}</td>
                          <td className="px-3 py-3 border-r border-gray-100">
                            <input type="number" min="0"
                              value={row.physicalQty}
                              onChange={e => updateRow(row.rowId, "physicalQty", e.target.value)}
                              disabled={row.status === "APPROVED"}
                              className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-[11px] font-black outline-none focus:border-blue-400 disabled:bg-gray-50 shadow-sm"
                              placeholder="Qty" />
                          </td>
                          <td className="px-3 py-3 border-r border-gray-100 text-center">
                            {inward > 0 ? <span className="text-green-600 font-black text-[10px] bg-green-50 px-1.5 py-0.5 rounded">+{inward}</span> : <span className="text-gray-200">-</span>}
                          </td>
                          <td className="px-3 py-3 border-r border-gray-100 text-center">
                            {outward > 0 ? <span className="text-red-500 font-black text-[10px] bg-red-50 px-1.5 py-0.5 rounded">-{outward}</span> : <span className="text-gray-200">-</span>}
                          </td>
                          <td className="px-3 py-3 border-r border-gray-100">
                            <input type="number" value={row.mrp}
                              onChange={e => updateRow(row.rowId, "mrp", e.target.value)}
                              disabled={row.status === "APPROVED"}
                              className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-[10px] font-black outline-none focus:border-blue-400 disabled:bg-gray-50"
                              placeholder="MRP" />
                          </td>
                          <td className="px-3 py-3 border-r border-gray-100">
                            <input type="text" value={row.batch}
                              onChange={e => updateRow(row.rowId, "batch", e.target.value)}
                              disabled={row.status === "APPROVED"}
                              className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-[10px] font-black outline-none disabled:bg-gray-50"
                              placeholder="Batch" />
                          </td>
                          <td className="px-3 py-3 border-r border-gray-100">
                            <input type="date" value={row.expiryDate}
                              onChange={e => updateRow(row.rowId, "expiryDate", e.target.value)}
                              disabled={row.status === "APPROVED"}
                              className="w-28 border border-gray-200 rounded-lg px-2 py-1.5 text-[9px] font-black outline-none disabled:bg-gray-50" />
                          </td>
                          <td className="px-3 py-3 border-r border-gray-100">
                            <MultiUserSelect
                              users={branchUsers}
                              selected={row.checkedBy}
                              onChange={(val) => updateRow(row.rowId, "checkedBy", val)}
                              disabled={row.status === "APPROVED"}
                            />
                          </td>
                          <td className="px-3 py-3 border-r border-gray-100 text-center">
                            {row.status === "APPROVED"
                              ? <span className="text-green-600 font-black text-[9px] uppercase bg-green-50 px-2 py-1 rounded-full">Approved</span>
                              : <span className="text-orange-500 font-black text-[9px] uppercase bg-orange-50 px-2 py-1 rounded-full">Draft</span>}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1 justify-center">
                              {row.status !== "APPROVED" && (
                                <>
                                  <button onClick={() => saveRow(row)} disabled={row.saving}
                                    className="px-3 py-1.5 bg-blue-600 text-white text-[9px] font-black rounded-lg hover:bg-blue-700 disabled:opacity-50 uppercase shadow-md shadow-blue-100">
                                    {row.saving ? "..." : "Save"}
                                  </button>
                                  {isAdmin && row.savedId && (
                                    <button onClick={() => approveRow(row)} disabled={row.saving}
                                      className="px-3 py-1.5 bg-emerald-600 text-white text-[9px] font-black rounded-lg hover:bg-emerald-700 disabled:opacity-50 uppercase shadow-md shadow-emerald-100">
                                      Approve
                                    </button>
                                  )}
                                  <button onClick={() => removeRow(row.rowId)}
                                    className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                                    <FaTrash size={12} />
                                  </button>
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

          {/* MOBILE ENTRY CARDS */}
          <div className="md:hidden space-y-4">
            {rows.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-dashed border-gray-300 text-center">
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Search products above to start</p>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {["Product", "Sys", "Phy", "Diff", "MRP", "Batch", "Staff", "Actions"].map(h => (
                        <th key={h} className="px-3 py-3 font-black text-[9px] uppercase tracking-widest text-gray-400 border-r last:border-0">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="py-12 text-center text-gray-300 font-black uppercase text-[10px] tracking-widest">
                          Search above to start
                        </td>
                      </tr>
                    ) : (
                      rows.map((row, idx) => {
                        const { inward, outward } = calc(row);
                        return (
                          <tr key={row.rowId} className={`hover:bg-gray-50 transition-colors ${row.status === "APPROVED" ? "bg-green-50/20" : ""}`}>
                            <td className="px-3 py-3 border-r border-gray-100 min-w-[140px]">
                              <p className="font-black text-gray-700 text-[10px] uppercase leading-tight truncate">{row.productName}</p>
                              <p className="text-[8px] font-bold text-gray-400 uppercase">{row.productGroupName || "-"}</p>
                            </td>
                            <td className="px-3 py-3 border-r border-gray-100 text-center font-black text-[10px] text-blue-500">{row.systemQty}</td>
                            <td className="px-3 py-3 border-r border-gray-100">
                              <input type="number" value={row.physicalQty} onChange={e => updateRow(row.rowId, "physicalQty", e.target.value)}
                                disabled={row.status === "APPROVED"}
                                className="w-16 border border-gray-200 rounded px-2 py-1 text-[10px] font-black outline-none focus:border-blue-400" />
                            </td>
                            <td className="px-3 py-3 border-r border-gray-100 text-center">
                              {inward > 0 && <span className="text-green-600 font-black text-[9px]">+{inward}</span>}
                              {outward > 0 && <span className="text-red-500 font-black text-[9px]">-{outward}</span>}
                              {inward === 0 && outward === 0 && <span className="text-gray-300">-</span>}
                            </td>
                            <td className="px-3 py-3 border-r border-gray-100">
                              <input type="number" value={row.mrp} onChange={e => updateRow(row.rowId, "mrp", e.target.value)}
                                disabled={row.status === "APPROVED"}
                                className="w-12 border border-gray-200 rounded px-1 py-1 text-[9px] font-black outline-none focus:border-blue-400" placeholder="MRP" />
                            </td>
                            <td className="px-3 py-3 border-r border-gray-100">
                              <input type="text" value={row.batch} onChange={e => updateRow(row.rowId, "batch", e.target.value)}
                                disabled={row.status === "APPROVED"}
                                className="w-16 border border-gray-200 rounded px-2 py-1 text-[9px] font-black outline-none" placeholder="Batch" />
                            </td>
                            <td className="px-3 py-3 border-r border-gray-100">
                              <MultiUserSelect users={branchUsers} selected={row.checkedBy} onChange={(val) => updateRow(row.rowId, "checkedBy", val)} disabled={row.status === "APPROVED"} />
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-1">
                                {row.status !== "APPROVED" ? (
                                  <>
                                    <button onClick={() => saveRow(row)} disabled={row.saving} className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 active:scale-90 transition">
                                      <FaCheck size={10} />
                                    </button>
                                    <button onClick={() => removeRow(row.rowId)} className="p-1.5 text-gray-300 hover:text-red-500">
                                      <FaTrash size={10} />
                                    </button>
                                  </>
                                ) : (
                                  <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                    <FaCheck size={10} />
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
          )}
        </div>
      </div>
    </div>
  </div>
  );
}
