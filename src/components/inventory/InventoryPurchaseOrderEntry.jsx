import { useEffect, useState } from "react";
import { FaPlus, FaTrash } from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { API_BASE } from "../../api";
import { useBranch } from "../../context/BranchContext";
import { useInventory } from "../../context/InventoryContext";
import InventoryAddProductModal from "./InventoryAddProductModal";
import InventoryAddProductGroupModal from "./InventoryAddProductGroupModal";
import InventoryAddVendorModal from "./InventoryAddVendorModal";
import InventoryAddVoucherTypeModal from "./InventoryAddVoucherTypeModal";
import InventoryAddWarehouseModal from "./InventoryAddWarehouseModal";

const InventoryPurchaseOrderEntry = ({
  items,
  setItems,
  voucherTypes,
  products,
  vendors,
  productGroups,
  salesOwners = [],
  salesMen = [],
  deliveryMen = [],
  customerGroups = [],
  onPOSaved = () => {}
}) => {
  const { warehouses } = useInventory();
  const { currentBranch } = useBranch();

  // Header State
  const [voucherType, setVoucherType] = useState("");
  const [vendor, setVendor] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [productGroup, setProductGroup] = useState("");
  const [billingPerson, setBillingPerson] = useState("");

  // Modal states
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [localVoucherTypes, setLocalVoucherTypes] = useState(voucherTypes || []);

  const [showVendorModal, setShowVendorModal] = useState(false);
  const [localVendors, setLocalVendors] = useState(vendors || []);

  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [localWarehouses, setLocalWarehouses] = useState(warehouses || []);

  const [showProductGroupModal, setShowProductGroupModal] = useState(false);
  const [localProductGroups, setLocalProductGroups] = useState(productGroups || []);

  const [showProductModal, setShowProductModal] = useState(false);
  const [localProducts, setLocalProducts] = useState(products || []);

  useEffect(() => { setLocalVoucherTypes(voucherTypes || []); }, [voucherTypes]);
  useEffect(() => { setLocalVendors(vendors || []); }, [vendors]);
  useEffect(() => { setLocalWarehouses(warehouses || []); }, [warehouses]);
  useEffect(() => { setLocalProductGroups(productGroups || []); }, [productGroups]);
  useEffect(() => { setLocalProducts(products || []); }, [products]);

  // Item Entry State
  const [selectedItem, setSelectedItem] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [qty, setQty] = useState("");
  const [purchasePrice, setPurchasePrice] = useState(0);
  const [sellingPrice, setSellingPrice] = useState(0);
  const [discountPercent, setDiscountPercent] = useState("");
  const [displayPrice, setDisplayPrice] = useState(0);
  const [hsn, setHsn] = useState("");
  const [gst, setGst] = useState(0);
  const [cgst, setCgst] = useState(0);
  const [sgst, setSgst] = useState(0);
  const [igst, setIgst] = useState(false);
  const [selectedProductData, setSelectedProductData] = useState(null);

  // Footer State
  const [extraExpenses, setExtraExpenses] = useState([]);
  const [showExtraExpensesModal, setShowExtraExpensesModal] = useState(false);
  const [expenseName, setExpenseName] = useState("");
  const [expensePrice, setExpensePrice] = useState("");
  const [expenseGst, setExpenseGst] = useState("");
  
  // Filter products by fetching from API when group changes
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Fetch products by product group from API
  useEffect(() => {
    console.log("🔄 Product Group changed to:", productGroup);
    
    if (!productGroup) {
      console.log("⚠️ No product group selected");
      setFilteredProducts(products || []);
      return;
    }

    const fetchProductsByGroup = async () => {
      setLoadingProducts(true);
      const url = `${API_BASE}/products/group/${productGroup}`;
      console.log(`📡 Fetching from: ${url}`);
      
      try {
        const res = await fetch(url);
        const data = await res.json();

        console.log(`📊 API Response:`, data);

        if (data.success) {
          console.log(`✅ Fetched ${data.data.length} products for group:`, productGroup);
          setFilteredProducts(data.data);
        } else {
          console.warn("⚠️ Failed to fetch products:", data.message);
          setFilteredProducts([]);
        }
      } catch (error) {
        console.error("❌ Error fetching products by group:", error);
        setFilteredProducts([]);
        toast.error("Failed to load products");
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchProductsByGroup();
  }, [productGroup, products]);

  // Dynamic Row Price
  useEffect(() => setDisplayPrice(purchasePrice * qty), [qty, purchasePrice]);

  // Auto CGST / SGST
  useEffect(() => {
    if (igst) {
      setCgst(0);
      setSgst(0);
    } else {
      setCgst(gst / 2);
      setSgst(gst / 2);
    }
  }, [gst, igst]);

  // Reset item when Product Group changes
  useEffect(() => {
    // Check if currently selected item belongs to the new product group
    if (selectedItem) {
      const product = filteredProducts.find(p => p._id === selectedItem);
      const pGroupId = product?.productGroup?._id || product?.productGroup || product?.groupId?._id || product?.groupId;
      if (pGroupId && String(pGroupId) === String(productGroup)) {
        return; // Don't reset if it matches the current group
      }
    }
    setSelectedItem("");
    setItemSearch("");
    setQty("");
    setPurchasePrice(0);
    setSellingPrice(0);
    setDisplayPrice(0);
    setHsn("");
    setGst(0);
    setIgst(false);
    setCgst(0);
    setSgst(0);
  }, [productGroup, selectedItem, filteredProducts]);

  // Auto-fetch Product Price / Tax / HSN
  const handleItemSelection = (productId) => {
    setSelectedItem(productId);
    setShowItemDropdown(false);

    // Search in filteredProducts (from API), not the products prop
    const product = filteredProducts.find((p) => p._id === productId);
    if (!product) {
      console.warn("⚠️ Product not found in filtered products:", productId);
      return;
    }

    setItemSearch(product.name);

    // Auto-select Product Group if not already selected or if different
    const pGroupId = product.productGroup?._id || product.productGroup || product.groupId?._id || product.groupId;
    if (pGroupId && pGroupId !== productGroup) {
      setProductGroup(pGroupId);
    }
    
    setSelectedProductData(product);
    setQty("");
    setPurchasePrice(product.purchasingPrice || product.rate || 0);
    setSellingPrice(product.sellingPrice || product.rate || 0);
    setDiscountPercent("");
    setHsn(product.hsnCode || product.hsncode || "");
    setGst(product.gst || product.tax || 0);
    if (!igst) {
      setCgst((product.gst || product.tax || 0) / 2);
      setSgst((product.gst || product.tax || 0) / 2);
    }
  };

  // Add Item
  const addItem = () => {
    if (!selectedItem || qty <= 0) {
      toast.error("Please select a valid item and quantity!");
      return;
    }

    const taxRate = igst ? gst : cgst + sgst;
    const rowTax = (displayPrice * taxRate) / 100;
    const total = displayPrice + rowTax;
    // Search in filteredProducts (from API), not the products prop
    const product = filteredProducts.find((p) => p._id === selectedItem);
    if (!product) {
      toast.error("Product not found!");
      return;
    }

    setItems((prev) => [
      ...prev,
      {
        productId: product._id,
        name: product.name,
        productGroup: product.productGroup || product.groupId,
        qty,
        perQty: product.perQty || 1,
        units: product.units || "",
        totalQty: product.totalQty || 0,
        purchasePrice,
        sellingPrice,
        discountPercent: parseFloat(discountPercent) || 0,
        rowPrice: displayPrice,
        hsn,
        gst,
        cgst,
        sgst,
        igst,
        total: total.toFixed(2),
      },
    ]);

    toast.success(`${product.name} added!`);

    setSelectedItem("");
    setItemSearch("");
    setSelectedProductData(null);
    setQty("");
    setPurchasePrice(0);
    setSellingPrice(0);
    setDiscountPercent("");
    setDisplayPrice(0);
    setHsn("");
    setGst(0);
    setIgst(false);
    setCgst(0);
    setSgst(0);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
    toast.info("Item removed!");
  };

  // Totals
  const subtotal = items.reduce((sum, item) => sum + item.rowPrice, 0);
  const totalTax = items.reduce((sum, item) => {
    const rate = item.igst ? item.gst : item.cgst + item.sgst;
    return sum + (item.rowPrice * rate) / 100;
  }, 0);
  
  const extraExpenseAmount = extraExpenses.reduce(
    (acc, exp) => acc + (exp.totalPrice || 0),
    0
  );
  const grandTotal = subtotal + totalTax + extraExpenseAmount;

  const handleAddExtraExpense = () => {
    if (!expenseName.trim() || !expensePrice) {
      toast.error("Please enter expense name and price");
      return;
    }

    const baseAmount = parseFloat(expensePrice) || 0;
    const gstPct = parseFloat(expenseGst) || 0;
    const gstAmount = (baseAmount * gstPct) / 100;
    const finalPrice = baseAmount + gstAmount;

    const newExpense = {
      id: Date.now(),
      expenseName: expenseName.trim(),
      amount: baseAmount,
      gst: gstPct,
      totalPrice: finalPrice,
    };

    setExtraExpenses((prev) => [...prev, newExpense]);
    setExpenseName("");
    setExpensePrice("");
    setExpenseGst("");
    setShowExtraExpensesModal(false);
    toast.success("Expense added!");
  };

  const handleRemoveExtraExpense = (id) => {
    setExtraExpenses(extraExpenses.filter((exp) => exp.id !== id));
    toast.info("Extra expense removed");
  };

  // Fetch next invoice ID from backend
  useEffect(() => {
    if (!voucherType || !currentBranch) return setInvoiceId("");
    const fetchNextInvoice = async () => {
      try {
        const branchId = currentBranch?._id || currentBranch?.id;
        const res = await fetch(
          `${API_BASE}/purchase-orders/next-invoice/${voucherType}?branchId=${branchId}`
        );
        const data = await res.json();
        if (res.ok) setInvoiceId(data.nextInvoiceId);
      } catch (err) {
        console.error(err);
      }
    };
    fetchNextInvoice();
  }, [voucherType, currentBranch]);

  // Reset Form after submission
  const resetForm = () => {
    // Header
    setVendor("");
    setWarehouse("");
    setProductGroup("");
    setBillingPerson("");
    
    // Items
    setItems([]);
    setSelectedItem("");
    setItemSearch("");
    setQty("");
    setPurchasePrice(0);
    setSellingPrice(0);
    setDiscountPercent("");
    setDisplayPrice(0);
    setHsn("");
    setGst(0);
    setCgst(0);
    setSgst(0);
    setIgst(false);
    setSelectedProductData(null);
    
    // Footer
    setExtraExpenses([]);
  };

  // Place Purchase Order
  const handleFinalAction = async () => {
    if (!voucherType) return toast.error("Select Voucher Type!");
    if (!vendor) return toast.error("Select Vendor!");
    if (!warehouse) return toast.error("Select Warehouse!");
    
    if (items.length === 0) return toast.error("Add at least one product!");

    const orderData = {
      branchId: currentBranch?._id || currentBranch?.id,
      voucherType,
      vendor,
      warehouse,
      items: items.map(item => ({
        ...item,
        total: Math.round(Number(item.total) || 0)
      })),
      subtotal: Math.round(subtotal),
      totalTax: Math.round(totalTax),
      extraExpenses: extraExpenses.map((exp) => ({
        expenseName: exp.expenseName,
        amount: Math.round(Number(exp.amount) || 0),
        gst: Math.round(Number(exp.gst) || 0),
        totalPrice: Math.round(Number(exp.totalPrice) || 0),
      })),
      extraExpenseAmount: Math.round(extraExpenseAmount),
      grandTotal: Math.round(grandTotal),
      billingPerson,
      invoiceId,
      status: "PLACED",
    };

    try {
      const res = await fetch(`${API_BASE}/purchase-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.message || "Failed to save order");

      toast.success("Purchase Order placed successfully!");
      setInvoiceId(data.order.invoiceId);
      resetForm();
      // Call parent callback to refresh records
      onPOSaved();
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong!");
    }
  };

  const inputClass =
    "w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-[#319bab] outline-none text-sm";
  const selectClass =
    "w-full border border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-1 focus:ring-[#319bab] outline-none text-sm appearance-none";
  const labelClass =
    "block text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-tight";

  return (
    <div className="space-y-6 font-sans">
      <ToastContainer
        position="top-right"
        autoClose={2500}
        newestOnTop
        closeOnClick
        pauseOnHover
        theme="colored"
        toastStyle={{
          background: "rgba(49, 155, 171, 0.85)",
          color: "#fff",
          backdropFilter: "blur(6px)",
          borderRadius: "12px",
          boxShadow: "0 8px 20px rgba(49,155,171,0.25)",
        }}
      />

      {/* HEADER */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100
                grid grid-cols-1 md:grid-cols-5 gap-4">

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">Voucher Type</label>
            <button 
              onClick={() => setShowVoucherModal(true)}
              className="text-[#319bab] hover:bg-[#319bab]/10 p-1 rounded transition"
              title="Create New Voucher Type"
            >
              <FaPlus size={12} />
            </button>
          </div>
          <select
            className={selectClass}
            value={voucherType}
            onChange={(e) => setVoucherType(e.target.value)}
          >
            <option value="">-- Select --</option>
            {localVoucherTypes.map((v) => (
              <option key={v._id} value={v.name}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

         <div>
          <label className={labelClass}>Invoice ID</label>
          <input
            type="text"
            className={`${inputClass} bg-gray-50 font-bold text-[#319bab]`}
            value={invoiceId}
            readOnly
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">Vendor</label>
            <button 
              onClick={() => setShowVendorModal(true)}
              className="text-[#319bab] hover:bg-[#319bab]/10 p-1 rounded transition"
              title="Create New Vendor"
            >
              <FaPlus size={12} />
            </button>
          </div>
          <select
            className={selectClass}
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
          >
            <option value="">-- Select --</option>
            {localVendors.map((v) => (
              <option key={v._id} value={v.name}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">Warehouse</label>
            <button 
              onClick={() => setShowWarehouseModal(true)}
              className="text-[#319bab] hover:bg-[#319bab]/10 p-1 rounded transition"
              title="Create New Warehouse"
            >
              <FaPlus size={12} />
            </button>
          </div>
          <select
            className={selectClass}
            value={warehouse}
            onChange={(e) => setWarehouse(e.target.value)}
          >
            <option value="">-- Select --</option>
            {localWarehouses.map((w) => (
              <option key={w._id} value={w.name}>
                {w.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Billing Person</label>
          <select className={selectClass} value={billingPerson} onChange={(e) => setBillingPerson(e.target.value)}>
            <option value="">-- Select --</option>
            {/* Sales Owners */}
            {salesOwners.length > 0 && (
              <>
                <option disabled>--- Sales Owners ---</option>
                {salesOwners.map((so) => (
                  <option key={`so-${so._id}`} value={so._id}>
                    {so.name} (Owner)
                  </option>
                ))}
              </>
            )}
            {/* Sales Men */}
            {salesMen.length > 0 && (
              <>
                <option disabled>--- Sales Men ---</option>
                {salesMen.map((sm) => (
                  <option key={`sm-${sm._id}`} value={sm._id}>
                    {sm.name} (Sales Man)
                  </option>
                ))}
              </>
            )}
            {/* Delivery Men */}
            {deliveryMen.length > 0 && (
              <>
                <option disabled>--- Delivery Men ---</option>
                {deliveryMen.map((dm) => (
                  <option key={`dm-${dm._id}`} value={dm._id}>
                    {dm.name} (Delivery Man)
                  </option>
                ))}
              </>
            )}
          </select>
        </div>

      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Input forms */}
        <div className="xl:col-span-4 space-y-6">

      {/* PRODUCT GROUP (Moved from 2-col to full-width in the left pane) */}
      <div className="grid grid-cols-1 gap-4">
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">Product Group</label>
            <button 
              onClick={() => setShowProductGroupModal(true)}
              className="text-[#319bab] hover:bg-[#319bab]/10 p-1 rounded transition"
              title="Create New Product Group"
            >
              <FaPlus size={12} />
            </button>
          </div>
          <select className={selectClass} value={productGroup} onChange={(e) => setProductGroup(e.target.value)}>
            <option value="">Select Product Group</option>
            {localProductGroups.map((g) => (
              <option key={g._id} value={g._id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ITEM ENTRY */}
      <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 space-y-4">
        {/* ROW 1: Wide Item Name */}
        <div className="grid grid-cols-1 gap-3">
          <div className="relative">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">Item Name</label>
              <button 
                onClick={() => setShowProductModal(true)}
                className="text-[#319bab] hover:bg-[#319bab]/10 p-1 rounded transition"
                title="Create New Item"
              >
                <FaPlus size={12} />
              </button>
            </div>
            <input
              type="text"
              placeholder="Type item name..."
              value={itemSearch}
              onChange={(e) => {
                setItemSearch(e.target.value);
                setShowItemDropdown(true);
              }}
              onFocus={() => setShowItemDropdown(true)}
              className={inputClass}
            />
            {showItemDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto w-max min-w-full">
                {filteredProducts
                  .filter(p => p.name.toLowerCase().includes(itemSearch.toLowerCase()))
                  .map((p) => (
                    <div
                      key={p._id}
                      onClick={() => handleItemSelection(p._id)}
                      className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b text-sm"
                    >
                      <div className="font-semibold">{p.name} ({p.perQty || 1}:{p.units || ""})</div>
                      <div className="text-gray-500 text-xs">Qty: {p.totalQty || 0}</div>
                    </div>
                  ))}
                {filteredProducts.filter(p => p.name.toLowerCase().includes(itemSearch.toLowerCase())).length === 0 && (
                  <div className="px-3 py-2 text-gray-500 text-sm">No products available</div>
                )}
              </div>
            )}
            {selectedProductData && (
              <div className="text-[10px] text-gray-500 mt-1">
                Available: {selectedProductData.totalQty || 0} {selectedProductData.units || ""}
              </div>
            )}
          </div>
        </div>

        {/* ROW 2: Prices, Qty, HSN */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className={labelClass}>Purchase ₹</label>
            <input
              type="number"
              className={inputClass}
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(+e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass}>Selling ₹</label>
            <input
              type="number"
              className={inputClass}
              value={sellingPrice}
              onChange={(e) => setSellingPrice(+e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass}>Discount %</label>
            <input
              type="number"
              className={inputClass}
              value={discountPercent}
              onChange={(e) => setDiscountPercent(e.target.value)}
              placeholder="0"
            />
          </div>

          <div>
            <label className={labelClass}>Qty</label>
            <input
              type="number"
              className={inputClass}
              value={qty}
              onChange={(e) => setQty(e.target.value === "" ? "" : +e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass}>HSN</label>
            <input 
              type="text" 
              className={inputClass} 
              value={hsn} 
              onChange={(e) => setHsn(e.target.value)}
              placeholder="Enter HSN Code"
            />
          </div>

          <div>
            <label className={labelClass}>Total ₹</label>
            <input
              type="number"
              className={`${inputClass} font-bold text-[#319bab]`}
              value={displayPrice}
              readOnly
            />
          </div>
        </div>

        {/* ROW 3: Taxes and Add Button */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <label className={labelClass}>GST %</label>
            <input
              type="number"
              className={inputClass}
              value={gst}
              onChange={(e) => setGst(+e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass}>CGST %</label>
            <input
              type="number"
              className={`${inputClass} bg-gray-50`}
              value={cgst}
              readOnly
            />
          </div>

          <div>
            <label className={labelClass}>SGST %</label>
            <input
              type="number"
              className={`${inputClass} bg-gray-50`}
              value={sgst}
              readOnly
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={igst}
              onChange={(e) => setIgst(e.target.checked)}
            />
            <span className="text-xs font-bold text-gray-600">IGST</span>
          </div>

          <div className="lg:col-span-4 mt-2">
            <button
              onClick={addItem}
              className="w-full bg-[#319bab] text-white h-[42px] rounded-xl font-bold flex items-center justify-center hover:bg-[#257f87] transition shadow-lg"
            >
              <FaPlus className="mr-2" /> ADD ITEM
            </button>
          </div>
        </div>
      </div>

      {/* Extra Expenses Section (Moved directly below Item Entry) */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[#319bab] font-black uppercase text-xs tracking-widest">
            Extra Expenses
          </h3>
          <button
            onClick={() => setShowExtraExpensesModal(true)}
            className="bg-orange-100 text-orange-600 px-4 py-2 rounded-lg font-bold text-xs hover:bg-orange-200 transition flex items-center gap-2"
          >
            + Add Expense
          </button>
        </div>

        {/* Display Added Extra Expenses */}
        {extraExpenses.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-bold">
                <tr>
                  <th className="px-3 py-2 text-left">Expense Name</th>
                  <th className="px-3 py-2 text-right">Base Amount</th>
                  <th className="px-3 py-2 text-right">GST %</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-center">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {extraExpenses.map((exp) => (
                  <tr key={exp.id} className="border-b transition hover:bg-gray-50">
                    <td className="px-3 py-2 font-semibold text-gray-800">
                      {exp.expenseName}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700">
                      ₹{(exp.amount || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right text-blue-600">
                      {(exp.gst || 0)}%
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-orange-600">
                      ₹{(exp.totalPrice || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => handleRemoveExtraExpense(exp.id)}
                        className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition"
                        title="Remove Expense"
                      >
                        <FaTrash />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-xl">
            No extra expenses added yet
          </div>
        )}
      </div>

      </div> {/* END LEFT COLUMN */}

      {/* RIGHT COLUMN: Table and Summary */}
      <div className="xl:col-span-8 flex flex-col gap-6">

        {/* ADDED ITEMS TABLE */}
        {items.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-[11px] font-bold">
                <tr>
                  <th className="px-4 py-3 text-left">Item</th>
                  <th className="px-4 py-3 text-center">Package</th>
                  <th className="px-4 py-3 text-center">Qty Ordered</th>
                  <th className="px-4 py-3 text-right">Rate</th>
                  <th className="px-4 py-3 text-right">Tax</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3 font-semibold">
                      {item.name}
                      <div className="text-[10px] text-gray-400">
                        HSN: {item.hsn}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      {item.perQty} {item.units}
                    </td>
                    <td className="px-4 py-3 text-center">{item.qty}</td>
                    <td className="px-4 py-3 text-right">₹{item.purchasePrice}</td>
                    <td className="px-4 py-3 text-right">
                      {item.igst
                        ? `IGST ${item.gst}%`
                        : `CGST ${item.cgst}% + SGST ${item.sgst}%`}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[#319bab]">
                      ₹{item.total}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => removeItem(index)}
                        className="text-red-500 hover:text-red-700 cursor-pointer"
                        title="Delete item"
                      >
                        <FaTrash className="inline-block" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* SUMMARY */}
        <div className="bg-white p-6 rounded-3xl shadow-xl border border-primary/5 h-fit sticky top-24">
          <h3 className="text-[#319bab] font-black uppercase text-xs tracking-widest mb-6 border-b pb-2 border-[#319bab]/30">
            Order Summary
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between text-sm uppercase tracking-tighter">
              <span className="text-gray-500 font-bold">Subtotal</span>
              <span className="font-bold text-gray-800">₹{Math.round(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm uppercase tracking-tighter">
              <span className="text-gray-500 font-bold">Tax Amount</span>
              <span className="font-bold text-gray-800">₹{Math.round(totalTax)}</span>
            </div>
            <div className="flex justify-between text-sm uppercase tracking-tighter">
              <span className="text-gray-500 font-bold">Extra Expenses</span>
              <span className="font-bold text-orange-500">
                ₹{Math.round(extraExpenseAmount)}
              </span>
            </div>
            <div className="pt-2 border-t border-gray-100 mt-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-800 font-black text-xs uppercase tracking-widest">
                  Grand Total
                </span>
                <span className="text-4xl font-black text-[#319bab] tracking-tight">
                  ₹{Math.round(grandTotal)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 mt-8">
              <button
                onClick={handleFinalAction}
                className="w-full bg-[#319bab] text-white py-3 rounded-xl font-bold uppercase text-[10px] hover:bg-[#257f87] transition"
              >
                Place Purchase Order
              </button>
            </div>
          </div>
        </div>

      </div> {/* END RIGHT COLUMN */}

    </div> {/* END MAIN LAYOUT GRID */}

    <InventoryAddVoucherTypeModal
      isOpen={showVoucherModal}
      onClose={() => setShowVoucherModal(false)}
      branchId={currentBranch?._id || currentBranch?.id}
      onSave={(newType) => {
        const addedType = newType.voucher || newType;
        setLocalVoucherTypes(prev => [...prev, addedType]);
        setVoucherType(addedType.name);
        setShowVoucherModal(false);
      }}
    />

    <InventoryAddWarehouseModal
      isOpen={showWarehouseModal}
      onClose={() => setShowWarehouseModal(false)}
      branchId={currentBranch?._id || currentBranch?.id}
      onSave={(newWarehouse) => {
        setLocalWarehouses(prev => [...prev, newWarehouse]);
        setWarehouse(newWarehouse.name);
        setShowWarehouseModal(false);
      }}
    />

    <InventoryAddVendorModal
      isOpen={showVendorModal}
      onClose={() => setShowVendorModal(false)}
      branchId={currentBranch?._id || currentBranch?.id}
      onSave={(newVendor) => {
        setLocalVendors(prev => [...prev, newVendor]);
        setVendor(newVendor.name);
        setShowVendorModal(false);
      }}
    />

    <InventoryAddProductGroupModal
      isOpen={showProductGroupModal}
      onClose={() => setShowProductGroupModal(false)}
      branchId={currentBranch?._id || currentBranch?.id}
      onSave={(newGroup) => {
        setLocalProductGroups(prev => [...prev, newGroup]);
        setProductGroup(newGroup._id);
        setShowProductGroupModal(false);
      }}
    />

    <InventoryAddProductModal
      isOpen={showProductModal}
      onClose={() => setShowProductModal(false)}
      branchId={currentBranch?._id || currentBranch?.id}
      productGroups={localProductGroups}
      warehouses={localWarehouses}
      onSave={(newProduct) => {
        const product = newProduct.data || newProduct;
        setLocalProducts(prev => [...prev, product]);
        setFilteredProducts(prev => [...prev, product]);
        setSelectedItem(product._id);
        setItemSearch(product.name);
        
        const pGroupId = product.productGroup?._id || product.productGroup || product.groupId?._id || product.groupId;
        if (pGroupId && pGroupId !== productGroup) {
          setProductGroup(pGroupId);
        }
        
        setSelectedProductData(product);
        setQty("");
        setPurchasePrice(product.purchasingPrice || product.rate || 0);
        setSellingPrice(product.sellingPrice || product.rate || 0);
        setHsn(product.hsnCode || product.hsncode || "");
        setGst(product.gst || product.tax || 0);
        if (!igst) {
          setCgst((product.gst || product.tax || 0) / 2);
          setSgst((product.gst || product.tax || 0) / 2);
        }

        setShowProductModal(false);
      }}
    />

    {/* Extra Expenses Modal */}
    {showExtraExpensesModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Add Extra Expense</h3>

          <div className="space-y-4">
            {/* Expense Name */}
            <div>
              <label className={labelClass}>Expense Name</label>
              <input
                type="text"
                className={inputClass}
                value={expenseName}
                onChange={(e) => setExpenseName(e.target.value)}
                placeholder="e.g., Loading Charge, Packing Charge"
              />
            </div>

            {/* Price */}
            <div>
              <label className={labelClass}>Base Amount (₹)</label>
              <input
                type="number"
                className={inputClass}
                value={expensePrice}
                onChange={(e) => setExpensePrice(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>

            {/* GST */}
            <div>
              <label className={labelClass}>GST (%)</label>
              <input
                type="number"
                className={inputClass}
                value={expenseGst}
                onChange={(e) => setExpenseGst(e.target.value)}
                placeholder="0"
                min="0"
                max="100"
              />
            </div>

            {/* Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-4">
              <button
                onClick={() => setShowExtraExpensesModal(false)}
                className="w-full border-2 border-gray-300 text-gray-700 py-2 rounded-lg font-bold hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAddExtraExpense}
                disabled={!expenseName.trim() || !expensePrice}
                className="w-full bg-orange-500 text-white py-2 rounded-lg font-bold hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Expense
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
  );
};

export default InventoryPurchaseOrderEntry;
