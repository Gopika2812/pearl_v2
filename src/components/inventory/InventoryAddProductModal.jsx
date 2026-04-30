import { useEffect, useState } from "react";
import { API_BASE, fetchWithAuth } from "../../api";
import FilterableCheckboxList from "../FilterableCheckboxList";
import FilterableSelect from "../FilterableSelect";

const InventoryAddProductModal = ({ isOpen, onClose, productGroups, productCategories = [], warehouses = [], branchId, onSave, editingItem }) => {
  useEffect(() => {
    if (isOpen) {
      console.log("📦 ProductModal opened with props:", {
        productGroups: productGroups?.length || 0,
        productCategories: productCategories?.length || 0,
        branchId,
      });
      console.log("  Product Groups:", productGroups);
      console.log("  Product Categories:", productCategories);
    }
  }, [isOpen, productGroups, productCategories, branchId]);
  
  const [product, setProduct] = useState({
    name: "",
    productGroup: "",
    productCategories: [],
    warehouse: "",
    perQty: "",
    units: "kg",
    totalQty: "",
    totalQtyUnit: "",
    purchasingPrice: "",
    sellingPrice: "",
    adminMargin: "",
    marginPercentage: "",
    mrp: "",
    hsnCode: "",
    gst: "",
    openingQty: "",
    manualOpeningDate: "2026-03-31",
    reorderLevel: 10,
    reorderQty: 20,
    leadTime: 7,
    minStockQty: 10,
    maxStockQty: 50,
    totalQtyUnit: "",
    preferredVendor: "",
    restockingConfig: {
      salesPeriodDays: 7,
      threshold: 30,
      restockingQty: 150
    },
    unitConversion: {
      value: 1,
      unit: "",
      altValue: 1,
      altUnit: ""
    }
  });

  // State to handle bulk upload results
  const [uploadResult, setUploadResult] = useState(null);
  const [skipExisting, setSkipExisting] = useState(false);

  // Pre-fill form when editing
  useEffect(() => {
    if (editingItem) {
      // Extract productGroup ID properly - handle string, ObjectId, or object formats
      let groupValue = "";
      if (editingItem.productGroup) {
        if (typeof editingItem.productGroup === "string") {
          groupValue = editingItem.productGroup;
        } else if (editingItem.productGroup._id) {
          groupValue = editingItem.productGroup._id;
        } else if (editingItem.productGroup.$oid) {
          groupValue = editingItem.productGroup.$oid;
        }
      }
      
      // Extract category IDs properly - handle string, ObjectId, or object formats
      const categories = (editingItem.productCategories || []).map(cat => 
        typeof cat === "string" ? cat : cat._id || cat.$oid || cat
      );
      
      // Extract warehouse ID properly - handle string, ObjectId, or object formats
      let warehouseValue = "";
      if (editingItem.warehouse) {
        if (typeof editingItem.warehouse === "string") {
          warehouseValue = editingItem.warehouse;
        } else if (editingItem.warehouse._id) {
          warehouseValue = editingItem.warehouse._id;
        } else if (editingItem.warehouse.$oid) {
          warehouseValue = editingItem.warehouse.$oid;
        }
      }
      
      setProduct({
        name: editingItem.name || "",
        productGroup: groupValue,
        productCategories: categories,
        warehouse: warehouseValue,
        perQty: editingItem.perQty || "",
        units: editingItem.units || "kg",
        totalQty: editingItem.totalQty || "",
        totalQtyUnit: editingItem.totalQtyUnit || "",
        purchasingPrice: editingItem.purchasingPrice || "",
        sellingPrice: editingItem.sellingPrice || "",
        adminMargin: editingItem.adminMargin || "",
        marginPercentage: editingItem.marginPercentage || "",
        mrp: editingItem.mrp || "",
        hsnCode: editingItem.hsnCode || "",
        gst: editingItem.gst || "",
        openingQty: editingItem.openingQty || "",
        manualOpeningDate: editingItem.manualOpeningDate ? new String(editingItem.manualOpeningDate).split('T')[0] : "2026-03-31",
        reorderLevel: editingItem.reorderLevel || 10,
        reorderQty: editingItem.reorderQty || 20,
        leadTime: editingItem.leadTime || 7,
        minStockQty: editingItem.minStockQty || 10,
        maxStockQty: editingItem.maxStockQty || 50,
        totalQtyUnit: editingItem.totalQtyUnit || "",
        preferredVendor: editingItem.preferredVendor || "",
        restockingConfig: editingItem.restockingConfig || {
          salesPeriodDays: 7,
          threshold: 30,
          restockingQty: 150
        },
        unitConversion: editingItem.unitConversion || {
          value: 1,
          unit: "",
          altValue: 1,
          altUnit: ""
        }
      });
    } else {
      setProduct({
        name: "",
        productGroup: "",
        productCategories: [],
        warehouse: "",
        perQty: "",
        units: "kg",
        totalQty: "",
        totalQtyUnit: "",
        purchasingPrice: "",
        sellingPrice: "",
        lockedPrice: "",
        marginPercentage: "",
        mrp: "",
        hsnCode: "",
        gst: "",
        openingQty: "",
        manualOpeningDate: "2026-03-31",
        reorderLevel: 10,
        reorderQty: 20,
        leadTime: 7,
        minStockQty: 10,
        maxStockQty: 50,
        totalQtyUnit: "",
        preferredVendor: "",
        restockingConfig: {
          salesPeriodDays: 7,
          threshold: 30,
          restockingQty: 150
        },
        unitConversion: {
          value: 1,
          unit: "",
          altValue: 1,
          altUnit: ""
        }
      });
    }
  }, [editingItem]);

  if (!isOpen) return null;

  const calculateSellingPrice = (purchasingPrice, marginPercent) => {
    const basePriceNum = Number(purchasingPrice || 0);
    const marginNum = Number(marginPercent || 0);
    // Formula: Selling Price = Purchase Price + (Purchase Price × Margin% / 100)
    return Math.round((basePriceNum + (basePriceNum * marginNum / 100)) * 100) / 100;
  };

  const calculateMargin = (purchasingPrice, sellingPrice) => {
    const purchaseNum = Number(purchasingPrice || 0);
    const sellingNum = Number(sellingPrice || 0);
    if (purchaseNum === 0) return 0;
    // Formula: Margin % = ((Selling Price - Purchase Price) / Purchase Price) × 100
    return ((sellingNum - purchaseNum) / purchaseNum) * 100;
  };

  const handleMarginChange = (value) => {
    const newMargin = Number(value || 0);
    const purchasingPrice = Number(product.purchasingPrice || 0);
    const newSellingPrice = calculateSellingPrice(purchasingPrice, newMargin);
    
    setProduct({
      ...product,
      marginPercentage: value,
      sellingPrice: newSellingPrice.toString(),
    });
  };

  const handleSellingPriceChange = (value) => {
    const newSellingPrice = Number(value || 0);
    const purchasingPrice = Number(product.purchasingPrice || 0);
    const newMargin = calculateMargin(purchasingPrice, newSellingPrice);
    
    setProduct({
      ...product,
      sellingPrice: value,
      marginPercentage: Math.round(newMargin * 100) / 100 !== 0 ? Math.round(newMargin * 100) / 100 : "",
    });
  };

  const handlePurchasingPriceChange = (value) => {
    const newPurchasingPrice = Number(value || 0);
    const margin = Number(product.marginPercentage || 0);
    const newSellingPrice = calculateSellingPrice(newPurchasingPrice, margin);
    
    setProduct({
      ...product,
      purchasingPrice: value,
      sellingPrice: newSellingPrice.toString(),
    });
  };

  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!branchId) {
      alert("Please select a branch first");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("branchId", branchId);
    formData.append("skipExisting", skipExisting);

    try {
      const res = await fetchWithAuth(`${API_BASE}/products/bulk-upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Bulk upload failed");
      }

      // Set the detailed results into state instead of closing
      setUploadResult({
        insertedCount: data.insertedCount || 0,
        skippedCount: data.skippedCount || 0,
        skipped: data.skipped || [],
      });
      console.log("Bulk upload response:", data);
    } catch (err) {
      console.error("Bulk upload error:", err);
      alert(err.message || "Bulk upload failed");
    }
  };

  const downloadErrorReport = () => {
    if (!uploadResult || !uploadResult.skipped || uploadResult.skipped.length === 0) return;

    // Create CSV content from skipped items
    const csvRows = [];
    // Headers
    csvRows.push(["Error Reason", "Raw Input Data"].join(","));

    uploadResult.skipped.forEach((item) => {
      const reason = `"${(item.reason || "Unknown reason").replace(/"/g, '""')}"`;
      // Convert the varied row object to a readable string
      const rawData = `"${JSON.stringify(item.row || {}).replace(/"/g, '""')}"`;
      csvRows.push([reason, rawData].join(","));
    });

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `bulk_upload_errors_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };



  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate required fields
    if (!product.name || !product.productGroup || !product.perQty || !product.units) {
      alert("Please fill in all required fields");
      return;
    }

    if (!branchId) {
      alert("Please select a branch first");
      return;
    }

    const payload = {
      branchId,
      name: product.name,
      productGroup: product.productGroup,
      productCategories: (product.productCategories || []).map(cat => 
        typeof cat === "string" ? cat : cat._id || cat
      ),
      warehouse: product.warehouse || null,
      perQty: Math.round(Number(product.perQty) * 100) / 100,
      units: product.units,
      totalQty: Math.round(Number(product.totalQty || 0) * 100) / 100,
      totalQtyUnit: product.totalQtyUnit || "",
      purchasingPrice: Math.round(Number(product.purchasingPrice || 0) * 100) / 100,
      sellingPrice: Math.round(Number(product.sellingPrice || 0) * 100) / 100,
      adminMargin: Math.round(Number(product.adminMargin || 0) * 100) / 100,
      marginPercentage: Math.round(Number(product.marginPercentage || 0) * 100) / 100,
      mrp: Math.round(Number(product.mrp || 0) * 100) / 100,
      hsnCode: product.hsnCode || "0000",
      gst: Math.round(Number(product.gst || 0) * 100) / 100,
      openingQty: product.openingQty !== "" ? Number(product.openingQty) : 0,
      manualOpeningDate: product.manualOpeningDate || "2026-03-31",
      reorderLevel: Number(product.reorderLevel),
      reorderQty: Number(product.reorderQty),
      leadTime: Number(product.leadTime),
      minStockQty: Number(product.minStockQty),
      maxStockQty: Number(product.maxStockQty),
      preferredVendor: product.preferredVendor,
      restockingConfig: product.restockingConfig,
      unitConversion: product.unitConversion
    };

    try {
      // If editing, use PUT; otherwise use POST
      const method = editingItem ? "PUT" : "POST";
      const url = editingItem 
        ? `${API_BASE}/products/${editingItem._id}` 
        : `${API_BASE}/products`;

      const res = await fetchWithAuth(url, {
        method,
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || `${editingItem ? "Update" : "Save"} failed`);

      alert(`Product ${editingItem ? "updated" : "saved"} successfully!`);
      console.log("Saved:", data);

      setProduct({
        name: "",
        productGroup: "",
        productCategories: [],
        perQty: "",
        units: "kg",
        totalQty: "",
        totalQtyUnit: "",
        purchasingPrice: "",
        sellingPrice: "",
        lockedPrice: "",
        margin: "",
        hsnCode: "",
        gst: "",
      });

      onClose();
    } catch (error) {
      console.error(`Product ${editingItem ? "update" : "save"} error:`, error.message);
      alert(`Product ${editingItem ? "update" : "save"} failed: ` + error.message);
    }
  };

  // Close handler that also resets upload results
  const handleModalClose = () => {
    setUploadResult(null);
    onClose();
  };



  const labelClass = "block text-sm font-medium text-gray-700 mb-1";
  const inputClass = "w-full p-2 border rounded-lg outline-primary focus:ring-1 focus:ring-primary transition-all";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

        <div className="bg-primary p-4 text-white flex justify-between items-center">
          <h3 className="text-xl font-bold">Add New Product</h3>
          <button onClick={handleModalClose} className="text-white hover:text-gray-200 font-bold text-xl">&times;</button>
        </div>

        <input
          type="file"
          accept=".xlsx,.xls"
          hidden
          id="productBulkUpload"
          onChange={handleBulkUpload}
        />

        {!uploadResult && (
          <div className="p-4 bg-blue-50 border-b flex flex-col gap-3">
            <div className="flex items-center gap-2 px-1">
              <input
                type="checkbox"
                id="skipExistingCheckbox"
                checked={skipExisting}
                onChange={(e) => setSkipExisting(e.target.checked)}
                className="w-4 h-4 text-primary rounded focus:ring-primary cursor-pointer"
              />
              <label htmlFor="skipExistingCheckbox" className="text-sm font-bold text-gray-700 cursor-pointer">
                Skip Existing Products (Check this to only add MISSING products without affecting current ones)
              </label>
            </div>
            <button
              type="button"
              onClick={() => document.getElementById("productBulkUpload").click()}
              className="w-full bg-green-600 text-white px-4 py-2.5 rounded-lg font-bold hover:bg-green-700 transition shadow-md active:scale-95 flex items-center justify-center gap-2"
            >
              <span>📤</span> Bulk Upload Products (Excel)
            </button>
          </div>
        )}


        {!uploadResult && (
          <form onSubmit={handleSubmit} className="p-6 text-gray-700 overflow-y-auto flex-1">
            {/* Product Name - Full Width */}
          <div className="mb-4">
            <label className={labelClass}>Product Name *</label>
            <input
              type="text"
              required
              className={`${inputClass} capitalize`}
              placeholder="Enter product name"
              value={product.name}
              onChange={(e) => setProduct({ ...product, name: e.target.value })}
            />
          </div>

          {/* Product Group - Full Width */}
          <div className="mb-4">
            <label className={labelClass}>Product Group *</label>
            <FilterableSelect
              options={Array.isArray(productGroups) ? productGroups : []}
              value={product.productGroup}
              onChange={(value) => {
                console.log("✋ Group selected:", value);
                setProduct({ ...product, productGroup: value });
              }}
              placeholder="-- Select Product Group --"
              className={inputClass}
            />
            {(!Array.isArray(productGroups) || productGroups.length === 0) && (
              <p style={{color: '#ff6b6b', fontSize: '12px', marginTop: '4px'}}>⚠️ No product groups available</p>
            )}
          </div>

          {/* Product Categories - Filterable Checkbox List */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className={labelClass}>🏷️ Product Categories (Optional)</label>
              {Array.isArray(productCategories) && productCategories.length > 0 && (
                <div className="flex gap-2">
                  {product.productCategories.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setProduct({ ...product, productCategories: [] })}
                      className="text-xs px-3 py-1 bg-red-100 text-red-700 rounded-full hover:bg-red-200 transition font-medium"
                    >
                      Clear All
                    </button>
                  )}
                  {product.productCategories.length < productCategories.length && (
                    <button
                      type="button"
                      onClick={() => setProduct({ ...product, productCategories: productCategories.map(c => c._id) })}
                      className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition font-medium"
                    >
                      Select All
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Selected Categories Tags */}
            {product.productCategories.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3 pb-2 border-b">
                {product.productCategories.map(catId => {
                  const category = productCategories.find(c => c._id === catId);
                  return category ? (
                    <span
                      key={catId}
                      className="bg-green-100 text-green-800 text-xs px-3 py-1 rounded-full flex items-center gap-2 font-medium"
                    >
                      ✓ {category.name}
                      <button
                        type="button"
                        onClick={() => setProduct({
                          ...product,
                          productCategories: product.productCategories.filter(id => id !== catId)
                        })}
                        className="text-green-600 hover:text-green-900 font-bold ml-1"
                      >
                        ×
                      </button>
                    </span>
                  ) : null;
                })}
              </div>
            )}

            {/* Filterable Checkbox List */}
            {Array.isArray(productCategories) && productCategories.length > 0 ? (
              <FilterableCheckboxList
                options={productCategories}
                selectedIds={product.productCategories}
                onChange={(selectedIds) => {
                  setProduct({ ...product, productCategories: selectedIds });
                }}
                placeholder="Search categories..."
              />
            ) : (
              <div style={{color: '#999', fontSize: '13px', padding: '12px', textAlign: 'center', border: '2px solid #e5e7eb', borderRadius: '8px'}}>
                📦 No product categories available
              </div>
            )}
          </div>

          {/* Warehouse - Full Width */}
          <div className="mb-4">
            <label className={labelClass}>🏭 Warehouse</label>
            <FilterableSelect
              options={Array.isArray(warehouses) ? warehouses : []}
              value={product.warehouse}
              onChange={(value) => {
                setProduct({ ...product, warehouse: value });
              }}
              placeholder="-- Select Warehouse (Optional) --"
              className={inputClass}
            />
            {Array.isArray(warehouses) && warehouses.length === 0 && (
              <p style={{color: '#999', fontSize: '12px', marginTop: '4px'}}>ℹ️ No warehouses available</p>
            )}
          </div>

          {/* Current Stock / Total Qty - NEW Section */}
          <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl mb-4">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-emerald-100">
               <div>
                  <label className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">🔒 Fixed Opening Stock (31-Mar-2026)</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input 
                      type="number"
                      className="w-32 p-2 border-2 border-orange-200 rounded-lg font-black text-orange-600 focus:border-orange-500 bg-white"
                      value={product.openingQty}
                      onChange={(e) => setProduct({...product, openingQty: e.target.value})}
                      placeholder="Anchor Qty"
                    />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vault Anchor</span>
                  </div>
               </div>
               <div className="text-right">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Last Snap Date</label>
                  <p className="text-xs font-bold text-slate-500">{product.manualOpeningDate}</p>
               </div>
            </div>

            <div className="flex items-center justify-between">
               <div>
                  <label className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">Current Calculated Stock</label>
                  <p className="text-2xl font-black text-emerald-700">{product.totalQty || 0} {product.units}</p>
               </div>
               <div className="text-right">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest italic block mb-1">Total Qty Override</label>
                  <input 
                    type="number"
                    className="w-24 p-2 text-right border rounded-lg font-black text-emerald-600 bg-white"
                    value={product.totalQty}
                    onChange={(e) => setProduct({...product, totalQty: e.target.value})}
                  />
               </div>
            </div>
            <p className="text-[9px] text-emerald-600/70 font-bold mt-2 italic px-1">
              Note: Changing 'Opening Qty' will automatically recalculate your 'Closing Stock' based on April records.
            </p>
          </div>

          {/* 2-Column Grid */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Per Qty */}
            <div>
              <label className={labelClass}>Per Qty (250) *</label>
              <input
                type="number"
                required
                className={inputClass}
                placeholder="e.g., 250"
                value={product.perQty}
                onChange={(e) => setProduct({ ...product, perQty: e.target.value })}
              />
            </div>

            {/* Units */}
            <div>
              <label className={labelClass}>Units (kg) *</label>
              <select
                required
                className={inputClass}
                value={product.units}
                onChange={(e) => setProduct({ ...product, units: e.target.value })}
              >
                <option value="kg">kg</option>
                <option value="gm">gm</option>
                <option value="ltr">ltr</option>
                <option value="ml">ml</option>
                <option value="pcs">pcs</option>
                <option value="pckts">pckts</option>
                <option value="units">units</option>
              </select>
            </div>
          </div>



          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Purchasing Price */}
            <div>
              <label className={labelClass}>Purchasing Price (₹)</label>
              <input
                type="number"
                step="0.01"
                className={inputClass}
                placeholder="0.00"
                value={product.purchasingPrice}
                onChange={(e) => handlePurchasingPriceChange(e.target.value)}
              />
            </div>

            {/* Normal Margin */}
            <div>
              <label className={labelClass}>Normal Margin (%)</label>
              <input
                type="number"
                step="0.01"
                className={inputClass}
                placeholder="e.g. 10"
                value={product.marginPercentage}
                onChange={(e) => handleMarginChange(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Selling Price */}
            <div>
              <label className={labelClass}>Selling Price (₹)</label>
              <input
                type="number"
                step="0.01"
                className={inputClass}
                placeholder="0.00"
                value={product.sellingPrice}
                onChange={(e) => handleSellingPriceChange(e.target.value)}
              />
            </div>

            {/* Admin Margin */}
            <div>
              <label className={labelClass}>Admin Margin (%) (Override)</label>
              <input
                type="number"
                step="0.01"
                className={inputClass}
                placeholder="e.g. -10"
                value={product.adminMargin}
                onChange={(e) => setProduct({ ...product, adminMargin: e.target.value })}
              />
              {product.adminMargin && product.sellingPrice && (
                <p className="text-[10px] text-primary font-bold mt-1">
                  Net Rate: ₹{(Number(product.sellingPrice) + (Number(product.sellingPrice) * Number(product.adminMargin) / 100)).toFixed(2)}
                </p>
              )}
            </div>
          </div>



          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* HSN Code */}
            <div>
              <label className={labelClass}>HSN Code</label>
              <input
                type="text"
                className={inputClass}
                placeholder="Enter HSN Code"
                value={product.hsnCode}
                onChange={(e) => setProduct({ ...product, hsnCode: e.target.value })}
              />
            </div>

            {/* GST */}
            <div>
              <label className={labelClass}>GST (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="28"
                className={inputClass}
                placeholder="Enter GST %"
                value={product.gst}
                onChange={(e) => setProduct({ ...product, gst: e.target.value })}
              />
            </div>
          </div>

          {/* INVENTORY OPTIMIZATION - NEW SECTION */}
          <div className="border-t pt-4 mb-4">
             <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Inventory Alerts & Thresholds</h4>
             <div className="grid grid-cols-3 gap-3">
                <div>
                   <label className="text-[9px] font-bold text-gray-500 uppercase">Reorder Level</label>
                   <input 
                     type="number" 
                     className={inputClass}
                     value={product.reorderLevel}
                     onChange={(e) => setProduct({...product, reorderLevel: e.target.value})}
                   />
                </div>
                <div>
                   <label className="text-[9px] font-bold text-gray-500 uppercase">Reorder Qty</label>
                   <input 
                     type="number" 
                     className={inputClass}
                     value={product.reorderQty}
                     onChange={(e) => setProduct({...product, reorderQty: e.target.value})}
                   />
                </div>
                <div>
                   <label className="text-[9px] font-bold text-gray-500 uppercase">Lead Time (Days)</label>
                   <input 
                     type="number" 
                     className={inputClass}
                     value={product.leadTime}
                     onChange={(e) => setProduct({...product, leadTime: e.target.value})}
                   />
                </div>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4 border-t pt-4">
              <div>
                <label className="text-[9px] font-bold text-gray-500 uppercase">Min Stock Qty</label>
                <input 
                  type="number" 
                  className={inputClass}
                  value={product.minStockQty}
                  onChange={(e) => setProduct({...product, minStockQty: e.target.value})}
                />
              </div>
              <div>
                <label className="text-[9px] font-bold text-gray-500 uppercase">Max Stock Qty</label>
                <input 
                  type="number" 
                  className={inputClass}
                  value={product.maxStockQty}
                  onChange={(e) => setProduct({...product, maxStockQty: e.target.value})}
                />
              </div>
          </div>

          {/* UNIT CONVERSION - NEW SECTION */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-4">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Unit Rules (Packaging)</h4>
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-500">Billing Ratio</label>
                      <div className="flex gap-2">
                          <input type="number" className="w-1/2 p-2 border rounded-lg" value={product.unitConversion.value} onChange={(e) => setProduct({...product, unitConversion: {...product.unitConversion, value: e.target.value}})} />
                          <input type="text" className="w-1/2 p-2 border rounded-lg bg-gray-100" placeholder="Unit (pcs)" value={product.unitConversion.unit} onChange={(e) => setProduct({...product, unitConversion: {...product.unitConversion, unit: e.target.value}})} />
                      </div>
                  </div>
                  <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-500">Pack Ratio</label>
                      <div className="flex gap-2">
                          <input type="number" className="w-1/2 p-2 border rounded-lg" value={product.unitConversion.altValue} onChange={(e) => setProduct({...product, unitConversion: {...product.unitConversion, altValue: e.target.value}})} />
                          <input type="text" className="w-1/2 p-2 border rounded-lg bg-gray-100" placeholder="Alt Unit (box)" value={product.unitConversion.altUnit} onChange={(e) => setProduct({...product, unitConversion: {...product.unitConversion, altUnit: e.target.value}})} />
                      </div>
                  </div>
              </div>
              <p className="text-[9px] text-emerald-600 font-bold mt-2 italic">Result: 1 {product.unitConversion.unit || 'unit'} = {product.unitConversion.altValue} {product.unitConversion.altUnit || 'alt-unit'}</p>
          </div>

          {/* Action Buttons - Sticky Bottom */}
          <div className="flex gap-3 mt-6 pb-2">
            <button
              type="button"
              onClick={handleModalClose}
              className="flex-1 p-2 border rounded-lg hover:bg-gray-50 transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 p-2 bg-primary text-white rounded-lg hover:opacity-90 transition-all font-bold shadow-md"
            >
              Save Product
            </button>
          </div>
        </form>
        )}

        {/* BULK UPLOAD RESULTS VIEW */}
        {uploadResult && (
          <div className="p-8 flex flex-col items-center justify-center text-center space-y-6 bg-gray-50 flex-1">
            <h3 className="text-2xl font-bold text-gray-800">Upload Complete</h3>
            
            <div className="flex gap-8 justify-center">
              <div className="bg-green-100 border border-green-200 rounded-xl p-4 min-w-[120px]">
                <p className="text-sm text-green-700 font-semibold mb-1">Inserted</p>
                <p className="text-3xl font-black text-green-600">{uploadResult.insertedCount}</p>
              </div>
              
              <div className={`${uploadResult.skippedCount > 0 ? 'bg-red-100 border-red-200 text-red-700' : 'bg-gray-100 border-gray-200 text-gray-700'} border rounded-xl p-4 min-w-[120px]`}>
                <p className="text-sm font-semibold mb-1">Skipped</p>
                <p className="text-3xl font-black">{uploadResult.skippedCount}</p>
              </div>
            </div>

            {uploadResult.skippedCount > 0 && (
              <div className="bg-red-50 p-4 rounded-xl border border-red-100 max-w-lg text-sm text-red-800 text-left">
                <p className="font-semibold mb-2">⚠️ Some items were skipped due to errors (e.g., missing groups, typos, duplicates, invalid prices).</p>
                <button 
                  onClick={downloadErrorReport}
                  className="w-full mt-2 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-bold shadow transition-colors flex items-center justify-center gap-2"
                >
                  📥 Download Error Report (CSV)
                </button>
              </div>
            )}

            <button 
              onClick={handleModalClose}
              className="mt-6 px-8 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-xl transition"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryAddProductModal;
