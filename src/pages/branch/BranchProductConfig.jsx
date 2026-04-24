import { useState, useEffect } from "react";
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";
import FilterableSelect from "../../components/FilterableSelect";
import FilterableCheckboxList from "../../components/FilterableCheckboxList";
import { toast } from "react-toastify";
import { FaSave, FaBoxOpen, FaLink, FaTag, FaChartLine, FaEdit, FaTrash, FaTimes, FaSearch, FaSync } from "react-icons/fa";

const inputClass = "w-full border border-gray-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all bg-white shadow-sm hover:border-emerald-200 text-sm";
const labelClass = "block text-[13px] font-black text-slate-500 mb-2 uppercase tracking-widest";
const cardClass = "bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100";

export default function BranchProductConfig() {
  const { currentBranch, user } = useBranch();
  const branchId = currentBranch?._id || currentBranch?.id;

  // Permission helper
  const isFieldAllowed = (fieldId) => {
    if (!user) return false;
    if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") return true;
    const key = `product-config_${fieldId}`;
    return user.fieldPermissions?.[key] !== false;
  };

  const [products, setProducts] = useState([]);
  const [productGroups, setProductGroups] = useState([]);
  const [productCategories, setProductCategories] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Configuration State
  const [config, setConfig] = useState({
    name: "",
    productGroup: "",
    productCategories: [],
    unitConversion: {
      value: 1,
      unit: "pcs",
      altValue: 1,
      altUnit: "box"
    },
    sellingPrice: 0,
    purchasingPrice: 0,
    availableQty: 0
  });

  const [selectedGroup, setSelectedGroup] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editConfig, setEditConfig] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyProduct, setHistoryProduct] = useState(null);

  // Search debounce logic
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Products are now fetched from the server based on active filters
  const filteredProducts = products;

  const startInlineEdit = (p) => {
    setEditingId(p._id);
    setEditConfig({
      name: p.name,
      productGroup: p.productGroup?._id || p.productGroup || "",
      productCategories: (p.productCategories || []).map(c => c._id || c),
      unitConversion: p.unitConversion || { value: 1, unit: p.units || "pcs", altValue: 1, altUnit: "box" },
      sellingPrice: p.sellingPrice || 0,
      purchasingPrice: p.purchasingPrice || 0,
      openingQty: p.openingQty || 0,
      manualOpeningDate: p.manualOpeningDate ? new Date(p.manualOpeningDate).toISOString().split('T')[0] : "2026-03-31"
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditConfig({});
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm("⚠️ Are you sure you want to delete this product? This will remove all records associated with it.")) return;

    try {
      const res = await fetchWithAuth(`${API_BASE}/products/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Product deleted successfully");
        fetchMasterData();
        if (selectedGroup) fetchProductsByGroup(selectedGroup, debouncedSearch);
      } else {
        const data = await res.json();
        throw new Error(data.message || "Failed to delete product");
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`⚠️ Are you sure you want to delete ${selectedIds.length} selected products? This action cannot be undone.`)) return;

    setIsBulkDeleting(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/products/bulk-delete`, {
        method: "DELETE",
        body: JSON.stringify({ ids: selectedIds })
      });

      if (res.ok) {
        toast.success(`${selectedIds.length} products deleted successfully`);
        setSelectedIds([]);
        fetchMasterData();
        if (selectedGroup) fetchProductsByGroup(selectedGroup, debouncedSearch);
      } else {
        const data = await res.json();
        throw new Error(data.message || "Bulk delete failed");
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredProducts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProducts.map(p => p._id));
    }
  };

  const toggleSelectRow = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    if (branchId) {
      fetchMasterData();
    }
  }, [branchId]);

  useEffect(() => {
    if (branchId && selectedGroup) {
      fetchProductsByGroup(selectedGroup, debouncedSearch);
    } else {
      setProducts([]);
    }
  }, [branchId, selectedGroup, debouncedSearch]);

  const fetchMasterData = async () => {
    setLoading(true);
    try {
      const [gRes, cRes] = await Promise.all([
        fetchWithAuth(`${API_BASE}/product-groups?branchId=${branchId}`),
        fetchWithAuth(`${API_BASE}/product-categories?branchId=${branchId}`)
      ]);

      const gData = await gRes.json();
      const cData = await cRes.json();

      setProductGroups(gData.data || gData || []);
      setProductCategories(cData.data || cData || []);
    } catch (err) {
      console.error("Failed to fetch master data:", err);
      toast.error("Failed to load Groups & Categories");
    } finally {
      setLoading(false);
    }
  };

  const fetchProductsByGroup = async (groupId, term = "") => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/products/group/${groupId}?search=${encodeURIComponent(term)}`);
      const data = await res.json();
      const list = data.data || data || [];
      setProducts(list);
    } catch (err) {
      console.error("Fetch group products error:", err);
      toast.error("Failed to fetch products for this group");
    } finally {
      setLoading(false);
    }
  };

  const handleProductSelect = (id) => {
    if (!Array.isArray(products)) return;
    const p = products.find(prod => prod._id === id);
    if (!p) return;

    setSelectedProduct(id);
    setConfig({
      name: p.name,
      productGroup: p.productGroup?._id || p.productGroup || "",
      productCategories: (p.productCategories || []).map(c => c._id || c),
      unitConversion: p.unitConversion || { value: 1, unit: p.units || "pcs", altValue: 1, altUnit: "box" },
      sellingPrice: p.sellingPrice || 0,
      purchasingPrice: p.purchasingPrice || 0,
      availableQty: p.totalQty || 0,
      openingQty: p.openingQty || 0,
      manualOpeningDate: p.manualOpeningDate ? new Date(p.manualOpeningDate).toISOString().split('T')[0] : "2026-03-31"
    });
  };

  const handleSave = async () => {
    if (!selectedProduct) return toast.warning("Select a product to save configuration");
    setIsSaving(true);

    try {
      const res = await fetchWithAuth(`${API_BASE}/products/${selectedProduct}`, {
        method: "PUT",
        body: JSON.stringify({
          productGroup: config.productGroup,
          productCategories: config.productCategories,
          unitConversion: config.unitConversion,
          openingQty: Number(config.openingQty),
          manualOpeningDate: config.manualOpeningDate
        })
      });

      if (res.ok) {
        toast.success("Product configuration updated successfully!");
        fetchProductsByGroup(selectedGroup, debouncedSearch); // Refresh the group list
      } else {
        const error = await res.json();
        throw new Error(error.message || "Failed to update");
      }
    } catch (err) {
      toast.error(err.message || "Server Error while saving");
    } finally {
      setIsSaving(false);
      setShowEditModal(false);
    }
  };

  return (
    <div className="w-full px-4 md:px-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">


      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <div className="p-3 bg-emerald-500 rounded-2xl text-white shadow-lg shadow-emerald-200">
              <FaBoxOpen size={24} />
            </div>
            Product Configuration <span className="text-emerald-500 italic">Bar</span>
          </h1>
          <p className="text-slate-500 font-medium mt-1">Manage global product groups, categories, and unit rules.</p>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-3 animate-in fade-in zoom-in slide-in-from-right-4 duration-300">
            <span className="text-slate-500 text-sm font-bold bg-slate-100 px-4 py-2 rounded-xl border border-slate-200">
              {selectedIds.length} selected
            </span>
            <button
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-6 py-2.5 rounded-xl font-black transition-all shadow-lg shadow-rose-200 disabled:opacity-50"
            >
              {isBulkDeleting ? <FaSync className="animate-spin" /> : <FaTrash />}
              {isBulkDeleting ? "Deleting..." : "Delete Selected"}
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="p-2.5 text-slate-400 hover:text-slate-600 transition-colors"
              title="Clear Selection"
            >
              <FaTimes size={18} />
            </button>
          </div>
        )}
      </div>

      {/* FILTER BAR */}
      <div className={`${cardClass} flex flex-col md:flex-row items-center gap-4`}>
        <div className="flex-1 w-full">
          <label className={labelClass}>Select Product Group</label>
          <select
            className={inputClass}
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
          >
            <option value="">All Product Groups</option>
            {productGroups.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
          </select>
        </div>
        <div className="flex-1 w-full relative">
          <label className={labelClass}>Search within group</label>
          <div className="relative">
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              type="text"
              className={`${inputClass} pl-10`}
              placeholder="Type product name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* PRODUCT TABLE */}
      <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                {isFieldAllowed("bar") && (
                  <th className="px-8 py-6 w-10">
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded-lg border-2 border-slate-300 text-emerald-500 focus:ring-emerald-500 transition-all cursor-pointer"
                      checked={filteredProducts.length > 0 && selectedIds.length === filteredProducts.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                )}
                {isFieldAllowed("details") && <th className="px-4 py-6 text-[12px] font-black uppercase tracking-widest text-slate-500">Product Details</th>}
                {isFieldAllowed("qty") && <th className="px-4 py-6 text-[12px] font-black uppercase tracking-widest text-slate-500">Available Qty</th>}
                {isFieldAllowed("unit") && <th className="px-4 py-6 text-[12px] font-black uppercase tracking-widest text-slate-500">Unit Conversion</th>}
                {isFieldAllowed("prices") && <th className="px-4 py-6 text-[12px] font-black uppercase tracking-widest text-slate-500">Prices</th>}
                {(isFieldAllowed("action_edit") || isFieldAllowed("action_delete")) && (
                  <th className="px-8 py-6 text-[12px] font-black uppercase tracking-widest text-slate-500 text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 min-h-[400px]">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="animate-spin rounded-full h-10 w-10 border-4 border-emerald-500 border-t-transparent"></div>
                      <p className="text-emerald-600 font-black uppercase text-[11px] tracking-widest animate-pulse">Fetching Group Products...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredProducts.map(p => (
                <tr key={p._id} className={`hover:bg-slate-50/50 transition-colors group ${selectedIds.includes(p._id) ? 'bg-emerald-50/30' : ''} ${editingId === p._id ? 'bg-yellow-50/50 ring-1 ring-yellow-200' : ''}`}>
                  {isFieldAllowed("bar") && (
                    <td className="px-8 py-5">
                      <input
                        type="checkbox"
                        className="w-5 h-5 rounded-lg border-2 border-slate-300 text-emerald-500 focus:ring-emerald-500 transition-all cursor-pointer"
                        checked={selectedIds.includes(p._id)}
                        onChange={() => toggleSelectRow(p._id)}
                      />
                    </td>
                  )}
                  {isFieldAllowed("details") && (
                    <td className="px-4 py-5">
                      {editingId === p._id ? (
                        <div className="space-y-2">
                          <input 
                            type="text"
                            className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                            value={editConfig.name}
                            onChange={(e) => setEditConfig({...editConfig, name: e.target.value})}
                          />
                          <select 
                            className="w-full border border-gray-300 rounded-lg px-2 py-1 text-[10px] font-bold text-emerald-600 uppercase"
                            value={editConfig.productGroup}
                            onChange={(e) => setEditConfig({...editConfig, productGroup: e.target.value})}
                          >
                            {productGroups.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
                          </select>
                        </div>
                      ) : (
                        <>
                          <p className="font-black text-slate-800 text-lg">{p.name}</p>
                          <p className="text-[12px] font-bold text-emerald-600 uppercase tracking-tighter mt-1">{p.productGroup?.name || "No Group"}</p>
                        </>
                      )}
                    </td>
                  )}
                  {isFieldAllowed("qty") && (
                    <td className="px-4 py-5">
                      {editingId === p._id ? (
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-orange-600 uppercase">Opening Qty</label>
                          <input 
                            type="number"
                            className="w-20 border border-orange-200 rounded-lg px-2 py-1 text-sm font-black focus:ring-2 focus:ring-orange-500 outline-none"
                            value={editConfig.openingQty}
                            onChange={(e) => setEditConfig({...editConfig, openingQty: e.target.value})}
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <span className="text-xl font-black text-slate-700">{p.totalQty || 0}</span>
                          <span className="text-[11px] font-black text-slate-400 uppercase">{p.units || "Units"}</span>
                        </div>
                      )}
                    </td>
                  )}
                  {isFieldAllowed("unit") && (
                    <td className="px-4 py-5 font-bold text-slate-600">
                      {editingId === p._id ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1">
                            <input 
                              type="number" 
                              className="w-12 border rounded px-1 text-center font-bold text-xs" 
                              value={editConfig.unitConversion.value}
                              onChange={(e) => setEditConfig({...editConfig, unitConversion: {...editConfig.unitConversion, value: Number(e.target.value)}})}
                            />
                            <input 
                              type="text" 
                              className="w-16 border rounded px-1 text-[10px] uppercase font-black bg-gray-50" 
                              value={editConfig.unitConversion.unit}
                              onChange={(e) => setEditConfig({...editConfig, unitConversion: {...editConfig.unitConversion, unit: e.target.value}})}
                            />
                          </div>
                          <div className="text-center text-[10px] font-black text-slate-300">=</div>
                          <div className="flex items-center gap-1">
                            <input 
                              type="number" 
                              className="w-12 border rounded px-1 text-center font-bold text-xs" 
                              value={editConfig.unitConversion.altValue}
                              onChange={(e) => setEditConfig({...editConfig, unitConversion: {...editConfig.unitConversion, altValue: Number(e.target.value)}})}
                            />
                            <input 
                              type="text" 
                              className="w-16 border rounded px-1 text-[10px] uppercase font-black bg-emerald-50" 
                              value={editConfig.unitConversion.altUnit}
                              onChange={(e) => setEditConfig({...editConfig, unitConversion: {...editConfig.unitConversion, altUnit: e.target.value}})}
                            />
                          </div>
                        </div>
                      ) : p.unitConversion ? (
                        <div className="flex items-center gap-2">
                          <span className="bg-slate-100 px-3 py-1 rounded text-[12px] font-bold text-slate-600">{p.unitConversion.value} {p.unitConversion.unit}</span>
                          <span className="text-slate-300 font-black">=</span>
                          <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded text-[12px] font-black">{p.unitConversion.altValue} {p.unitConversion.altUnit}</span>
                        </div>
                      ) : (
                        <span className="text-slate-300 italic text-[12px]">No conversion set</span>
                      )}
                    </td>
                  )}
                  {isFieldAllowed("prices") && (
                    <td className="px-4 py-5 whitespace-nowrap">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col text-[12px] font-bold">
                          <div className="text-slate-400 font-black uppercase text-[9px] mb-0.5 tracking-widest">Master Rates</div>
                          <div className="flex items-center gap-4">
                            <div className="text-slate-400">P: <span className="text-slate-800 text-sm">₹{(p.purchasingPrice || 0).toFixed(2)}</span></div>
                            <div className="text-emerald-500">S: <span className="text-emerald-700 text-sm font-black">₹{(p.sellingPrice || 0).toFixed(2)}</span></div>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setHistoryProduct(p);
                            setShowHistoryModal(true);
                          }}
                          className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-[#319bab]/10 hover:text-[#319bab] transition border border-transparent hover:border-[#319bab]/20 group/icon"
                          title="View Price Timeline"
                        >
                          <FaChartLine size={14} className="group-hover/icon:scale-110 transition-transform" />
                        </button>
                      </div>
                    </td>
                  )}
                  {(isFieldAllowed("action_edit") || isFieldAllowed("action_delete")) && (
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {editingId === p._id ? (
                          <>
                            <button
                              onClick={() => handleSave(p._id)}
                              disabled={isSaving}
                              className="p-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition shadow-lg shadow-emerald-200"
                              title="Save Changes"
                            >
                              <FaSave size={16} />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-2 bg-gray-100 text-gray-500 rounded-xl hover:bg-gray-200 transition"
                              title="Cancel"
                            >
                              <FaTimes size={16} />
                            </button>
                          </>
                        ) : (
                          <>
                            {isFieldAllowed("action_edit") && (
                              <button
                                onClick={() => startInlineEdit(p)}
                                className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-500 hover:text-white transition shadow-sm border border-emerald-100"
                              >
                                <FaEdit size={16} />
                              </button>
                            )}
                            {isFieldAllowed("action_delete") && (
                              <button
                                onClick={() => handleDeleteProduct(p._id)}
                                className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-500 hover:text-white transition shadow-sm border border-rose-100"
                              >
                                <FaTrash size={16} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-4 bg-slate-50 rounded-full text-slate-200"><FaBoxOpen size={48} /></div>
                      <p className="text-slate-400 font-bold uppercase text-[11px] tracking-widest">No products found in this group</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* PRICE HISTORY TIMELINE MODAL */}
      {showHistoryModal && historyProduct && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300 max-h-[85vh] flex flex-col border border-slate-100">
            {/* Header */}
            <div className="bg-[#319bab] p-6 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-2xl"><FaChartLine size={20} /></div>
                <div>
                  <h2 className="text-xl font-black">{historyProduct.name}</h2>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/70">Historical Price Timeline</p>
                </div>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="p-2 hover:bg-white/10 rounded-xl transition"><FaTimes size={20} /></button>
            </div>

            {/* Content */}
            <div className="p-8 overflow-y-auto flex-1 bg-slate-50/50 custom-scrollbar">
              {(!historyProduct.priceHistory || historyProduct.priceHistory.length === 0) ? (
                <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-100">
                  <FaChartLine size={48} className="mx-auto text-slate-200 mb-4" />
                  <p className="text-slate-400 font-bold uppercase text-[11px] tracking-widest">No detailed history found yet.<br />Changes will appear here after your next sync/invoice.</p>
                </div>
              ) : (
                <div className="relative border-l-2 border-[#319bab]/20 ml-4 space-y-8 pl-8">
                  {historyProduct.priceHistory.sort((a, b) => new Date(b.effectiveDate || b.createdAt) - new Date(a.effectiveDate || a.createdAt)).map((log, idx) => (
                    <div key={idx} className="relative">
                      {/* Dot */}
                      <div className={`absolute -left-[41px] top-1 h-4 w-4 rounded-full border-4 border-white shadow-sm ${log.type === 'INCREASE' ? 'bg-red-500' : log.type === 'DECREASE' ? 'bg-green-500' : 'bg-[#319bab]'
                        }`} />

                      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${log.type === 'INCREASE' ? 'bg-red-100 text-red-600' : log.type === 'DECREASE' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                              }`}>
                              {log.type}
                            </span>
                            <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{new Date(log.effectiveDate || log.createdAt).toLocaleString()}</div>
                          </div>
                          <div className="text-[10px] font-black text-[#319bab] uppercase bg-[#319bab]/5 px-3 py-1 rounded-lg border border-[#319bab]/10">
                            {log.sourceVoucher || "Manual Update"}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Purchase Rate Shift</label>
                            <div className="flex items-center gap-2 font-black">
                              <span className="text-slate-400 text-xs">₹{log.oldPurchasingPrice?.toFixed(2)}</span>
                              <span className={log.type === 'INCREASE' ? 'text-red-500' : log.type === 'DECREASE' ? 'text-green-500' : 'text-[#319bab]'}>→</span>
                              <span className="text-slate-800 text-sm">₹{log.newPurchasingPrice?.toFixed(2)}</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Auto-Selling Sync</label>
                            <div className="flex items-center gap-2 font-black">
                              <span className="text-slate-400 text-xs">₹{log.oldSellingPrice?.toFixed(2)}</span>
                              <span className="text-emerald-500 italic">→</span>
                              <span className="text-emerald-700 text-sm">₹{log.newSellingPrice?.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                        {log.note && <div className="mt-3 pt-3 border-t border-slate-50 text-[10px] font-medium text-slate-500 italic">"{log.note}"</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
              <button onClick={() => setShowHistoryModal(false)} className="px-10 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition">Close Timeline</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
