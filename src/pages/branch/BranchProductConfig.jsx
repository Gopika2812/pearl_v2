import { useState, useEffect } from "react";
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";
import FilterableSelect from "../../components/FilterableSelect";
import FilterableCheckboxList from "../../components/FilterableCheckboxList";
import { toast, ToastContainer } from "react-toastify";
import { FaSave, FaBoxOpen, FaLink, FaTag, FaChartLine } from "react-icons/fa";

const inputClass = "w-full border border-gray-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all bg-white shadow-sm hover:border-emerald-200 text-sm";
const labelClass = "block text-[11px] font-black text-slate-500 mb-1.5 uppercase tracking-widest";
const cardClass = "bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100";

export default function BranchProductConfig() {
  const { currentBranch } = useBranch();
  const branchId = currentBranch?._id || currentBranch?.id;

  const [products, setProducts] = useState([]);
  const [productGroups, setProductGroups] = useState([]);
  const [productCategories, setProductCategories] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [isSaving, setIsSaving] = useState(false);

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

  useEffect(() => {
    if (branchId) {
      fetchMasterData();
    }
  }, [branchId]);

  const fetchMasterData = async () => {
    try {
      const [pRes, gRes, cRes] = await Promise.all([
        fetchWithAuth(`${API_BASE}/products?branchId=${branchId}&limit=10000`),
        fetchWithAuth(`${API_BASE}/product-groups?branchId=${branchId}`),
        fetchWithAuth(`${API_BASE}/product-categories?branchId=${branchId}`)
      ]);

      const pData = await pRes.json();
      const gData = await gRes.json();
      const cData = await cRes.json();

      const pList = pData.data || pData || [];
      console.log(`📦 Fetched ${pList.length} products for configuration`);
      
      setProducts(pList);
      setProductGroups(gData.data || gData || []);
      setProductCategories(cData.data || cData || []);
    } catch (err) {
      console.error("Failed to fetch master data:", err);
      toast.error("Failed to load Master Data");
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
      availableQty: p.totalQty || 0
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
          unitConversion: config.unitConversion
        })
      });

      if (res.ok) {
        toast.success("Product configuration updated successfully!");
        fetchMasterData(); // Refresh list to get latest state
      } else {
        const error = await res.json();
        throw new Error(error.message || "Failed to update");
      }
    } catch (err) {
      toast.error(err.message || "Server Error while saving");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <ToastContainer hideProgressBar theme="colored" />

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
        
        <button 
          onClick={handleSave}
          disabled={isSaving || !selectedProduct}
          className="flex items-center gap-2 bg-slate-900 text-white px-8 py-3.5 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95"
        >
          {isSaving ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" /> : <FaSave />}
          {isSaving ? "Saving..." : "Save Master Config"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* SELECTION AREA */}
        <div className="lg:col-span-12">
            <div className={`${cardClass} flex flex-col md:flex-row items-end gap-6`}>
                <div className="flex-1 w-full relative">
                    <label className={labelClass}>Select Product to Configure</label>
                    <FilterableSelect
                        options={products}
                        value={selectedProduct}
                        onChange={handleProductSelect}
                        placeholder="Search product by name..."
                    />
                </div>
                
                <div className="w-full md:w-64">
                    <label className={labelClass}>Stock Level (Read Only)</label>
                    <div className="px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                         <span className="font-black text-slate-800 text-lg">{config.availableQty}</span>
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{(Array.isArray(products) ? products : []).find(p => p._id === selectedProduct)?.units || "Units"}</span>
                    </div>
                </div>
            </div>
        </div>

        {/* LEFT COLUMN: IDENTITY */}
        <div className="lg:col-span-5 space-y-6">
            <div className={cardClass}>
                <div className="flex items-center gap-2 mb-6 border-b pb-4">
                    <FaTag className="text-emerald-500" />
                    <h2 className="font-black text-slate-800 uppercase text-xs tracking-widest">Grouping & Identity</h2>
                </div>
                
                <div className="space-y-6">
                    <div>
                        <label className={labelClass}>Product Group</label>
                        <select 
                            className={inputClass}
                            value={config.productGroup}
                            onChange={(e) => setConfig({...config, productGroup: e.target.value})}
                        >
                            <option value="">-- No Group Selected --</option>
                            {Array.isArray(productGroups) && productGroups.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className={labelClass}>Product Categories</label>
                        <div className="border border-slate-100 p-2 rounded-2xl bg-slate-50/50 min-h-[140px]">
                            <FilterableCheckboxList
                                options={Array.isArray(productCategories) ? productCategories : []}
                                selectedIds={Array.isArray(config.productCategories) ? config.productCategories : []}
                                onChange={(ids) => setConfig({...config, productCategories: ids})}
                                placeholder="Filter Category List..."
                            />
                        </div>
                    </div>
                </div>
            </div>

             <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-3xl text-white shadow-xl shadow-slate-300">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-white/10 rounded-lg text-emerald-400"><FaChartLine size={18} /></div>
                    <h3 className="font-bold text-sm">Pricing Insight</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-[10px] text-white/50 font-bold uppercase mb-1">Purchasing Price</p>
                        <p className="text-2xl font-black italic">₹{config.purchasingPrice.toFixed(2)}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-white/50 font-bold uppercase mb-1">Selling Price</p>
                        <p className="text-2xl font-black italic">₹{config.sellingPrice.toFixed(2)}</p>
                    </div>
                </div>
            </div>
        </div>

        {/* RIGHT COLUMN: CONVERSION Logic */}
        <div className="lg:col-span-7">
            <div className={`${cardClass} h-full flex flex-col`}>
                <div className="flex items-center gap-2 mb-6 border-b pb-4">
                    <FaLink className="text-emerald-500" />
                    <h2 className="font-black text-slate-800 uppercase text-xs tracking-widest">Unit Conversion Phase</h2>
                </div>

                <div className="flex-1 flex flex-col justify-center gap-8 py-4">
                    <p className="text-sm text-slate-500 text-center px-12 leading-relaxed">
                        Define the relationship between your standard billing unit and your alternate packing unit.
                    </p>

                    <div className="bg-emerald-50/50 border-2 border-emerald-100 p-8 rounded-[40px] flex items-center justify-between gap-4 max-w-lg mx-auto w-full relative">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-widest shadow-lg">
                            Ratio Definition
                        </div>

                        <div className="flex-1 space-y-3">
                             <input 
                                type="number" 
                                className={`${inputClass} text-center font-black text-xl`} 
                                value={config.unitConversion.value}
                                onChange={(e) => setConfig({
                                    ...config, 
                                    unitConversion: {...config.unitConversion, value: Number(e.target.value)}
                                })}
                             />
                             <input 
                                type="text" 
                                className={`${inputClass} text-center font-bold text-emerald-600 bg-emerald-100/50 border-emerald-200 capitalize`}
                                placeholder="Unit Code"
                                value={config.unitConversion.unit}
                                onChange={(e) => setConfig({
                                    ...config, 
                                    unitConversion: {...config.unitConversion, unit: e.target.value}
                                })}
                             />
                        </div>

                        <div className="text-4xl font-black text-slate-300 transform scale-150">=</div>

                        <div className="flex-1 space-y-3">
                             <input 
                                type="number" 
                                className={`${inputClass} text-center font-black text-xl`} 
                                value={config.unitConversion.altValue}
                                onChange={(e) => setConfig({
                                    ...config, 
                                    unitConversion: {...config.unitConversion, altValue: Number(e.target.value)}
                                })}
                             />
                             <input 
                                type="text" 
                                className={`${inputClass} text-center font-bold text-emerald-600 bg-emerald-100/50 border-emerald-200 capitalize`}
                                placeholder="Alt Code"
                                value={config.unitConversion.altUnit}
                                onChange={(e) => setConfig({
                                    ...config, 
                                    unitConversion: {...config.unitConversion, altUnit: e.target.value}
                                })}
                             />
                        </div>
                    </div>

                    <div className="mt-8 p-6 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center">
                        <p className={labelClass}>Visual Verification</p>
                        <div className="flex items-center gap-4">
                            <div className="bg-white px-6 py-4 rounded-xl shadow-sm border border-slate-200">
                                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Billing Value</p>
                                <p className="font-black text-xl text-slate-700">{config.unitConversion.value} <span className="text-emerald-500 uppercase italic text-sm">{config.unitConversion.unit}</span></p>
                            </div>
                            <div className="w-10 h-1 bg-slate-200 rounded-full"></div>
                            <div className="bg-emerald-900 px-6 py-4 rounded-xl shadow-lg shadow-emerald-100 border border-emerald-800">
                                <p className="text-[10px] text-white/50 font-bold uppercase mb-1">Pack Size</p>
                                <p className="font-black text-xl text-white">{config.unitConversion.altValue} <span className="text-emerald-400 uppercase italic text-sm">{config.unitConversion.altUnit}</span></p>
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-4 italic font-medium px-8 text-center uppercase tracking-wide">
                            Example: 1 {config.unitConversion.unit} will show as ({config.unitConversion.value > 0 ? (config.unitConversion.altValue / config.unitConversion.value).toFixed(2) : 0} {config.unitConversion.altUnit}) in orders phase.
                        </p>
                    </div>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}
