import { useEffect, useMemo, useState } from "react";
import { FaPlus, FaTrash } from "react-icons/fa";
import { ToastContainer, toast } from "react-toastify";
import { API_BASE } from "../../api";

const inputClass =
  "w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-[#319bab] outline-none text-sm";
const selectClass =
  "w-full border border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-1 focus:ring-[#319bab] outline-none text-sm appearance-none";
const labelClass =
  "block text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-tight";


export default function InventorySalesOrderEntry({
  voucherTypes = [],
  warehouses = [],
  products = [],
  productGroups = [],
  customers = [],
  salesMen = [],
  deliveryMen = [],
  salesOwners = []
}) {
  const [voucherType, setVoucherType] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [warehouse, setWarehouse] = useState("");


  const [productGroup, setProductGroup] = useState("");
  const [selectedItem, setSelectedItem] = useState("");
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [sellingPrice, setSellingPrice] = useState(0);
  const [qty, setQty] = useState(1);
  const [gst, setGst] = useState(0);
  const [cgst, setCgst] = useState(0);
  const [sgst, setSgst] = useState(0);
  const [igst, setIgst] = useState(false);
  const [hsn, setHsn] = useState("");

  const [items, setItems] = useState([]);
  const [sampleItems, setSampleItems] = useState([]);

  const [sampleProductGroup, setSampleProductGroup] = useState("");
  const [sampleSelectedItem, setSampleSelectedItem] = useState("");
  const [sampleQty, setSampleQty] = useState(1);
  const [sampleSellingPrice, setSampleSellingPrice] = useState(0);
  const [sampleItemSearch, setSampleItemSearch] = useState("");
  const [showSampleItemDropdown, setShowSampleItemDropdown] = useState(false);
  const [filteredSampleProducts, setFilteredSampleProducts] = useState([]);
  const [loadingSampleProducts, setLoadingSampleProducts] = useState(false);
  const [availableQtyCache, setAvailableQtyCache] = useState({});

  const [transportCharge, setTransportCharge] = useState(0);

  const [enableEway, setEnableEway] = useState(false);
  const [ewayBillNo, setEwayBillNo] = useState("");

  const [ewayDate, setEwayDate] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [transportMode, setTransportMode] = useState("Road");
  const [transporterName, setTransporterName] = useState("");
  const [poItems, setPoItems] = useState([]);
  const [discountType, setDiscountType] = useState("PERCENT");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountAmountInput, setDiscountAmountInput] = useState(0);
  const [customerId, setCustomerId] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [showRecentPanel, setShowRecentPanel] = useState(true);
  const [salesOwner, setSalesOwner] = useState("");
  const [salesOwnerId, setSalesOwnerId] = useState("");
  const [salesMan, setSalesMan] = useState("");
  const [deliveryMan, setDeliveryMan] = useState("");
  const [billingPerson, setBillingPerson] = useState("");
  const [customerMargin, setCustomerMargin] = useState(0);
  
  // SEARCH STATES FOR TYPING
  const [customerSearch, setCustomerSearch] = useState("");
  const [productGroupSearch, setProductGroupSearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showProductGroupDropdown, setShowProductGroupDropdown] = useState(false);
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [fetchedCustomers, setFetchedCustomers] = useState([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);


  useEffect(() => {
    if (!voucherType) {
      setInvoiceId("");
      // Reset product selection when voucher type changes
      setProductGroup("");
      setProductGroupSearch("");
      setSelectedItem("");
      setItemSearch("");
      setFilteredProducts([]);
      setItems([]);
      return;
    }

    const fetchPreview = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/sales-orders/preview/${voucherType}`
        );
        const data = await res.json();

        if (!res.ok) throw new Error(data.message);

        setInvoiceId(data.invoiceId);
      } catch (err) {
        toast.error("Failed to generate invoice number");
        setInvoiceId("");
      }
    };

    // Reset product selection when voucher type changes
    setProductGroup("");
    setProductGroupSearch("");
    setSelectedItem("");
    setItemSearch("");
    setFilteredProducts([]);
    setItems([]);

    fetchPreview();
  }, [voucherType]);

  // Load purchase order items for HSN fallback
  useEffect(() => {
    const loadPoItems = async () => {
      try {
        const res = await fetch(`${API_BASE}/purchase-orders/items`);
        const data = await res.json();
        if (!res.ok) throw new Error();
        setPoItems(data || []);
      } catch {
        console.warn("Failed to load purchase order data for HSN");
      }
    };

    loadPoItems();
  }, []);

  // Fetch customers from backend when searching
  useEffect(() => {
    if (!customerSearch.trim()) {
      // If search is empty, use all provided customers
      setFetchedCustomers(customers);
      return;
    }

    // Fetch from backend if search has content
    const fetchCustomersFromBackend = async () => {
      setSearchingCustomers(true);
      try {
        const res = await fetch(
          `${API_BASE}/customers?search=${encodeURIComponent(customerSearch)}&limit=100`
        );
        const data = await res.json();
        setFetchedCustomers(data.data || data || []);
      } catch (err) {
        console.error("Failed to search customers:", err);
        setFetchedCustomers([]);
      } finally {
        setSearchingCustomers(false);
      }
    };

    const timer = setTimeout(fetchCustomersFromBackend, 300); // Debounce 300ms
    return () => clearTimeout(timer);
  }, [customerSearch]);
  
  // Initialize with provided customers on mount
  useEffect(() => {
    setFetchedCustomers(customers);
  }, []);


  // Reset filtered products and items when warehouse changes
  useEffect(() => {
    setFilteredProducts([]);
    setSelectedItem("");
    setItemSearch("");
  }, [warehouse]);

  useEffect(() => {
    if (recentOrders.length > 0) setShowRecentPanel(true);
  }, [recentOrders]);

  const fetchRecentOrders = async (customerId, productId) => {
    if (!customerId || !productId) {
      setRecentOrders([]);
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE}/sales-orders/recent?customerId=${customerId}&productId=${productId}&limit=5`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch");

      setRecentOrders(data.data || []);
    } catch (err) {
      toast.error(err.message || "Failed to fetch recent orders");
      setRecentOrders([]);
    }
  };


  // Fetch products by product group from API
  useEffect(() => {
    if (!productGroup) {
      setFilteredProducts([]);
      return;
    }

    const fetchProductsByGroup = async () => {
      setLoadingProducts(true);
      try {
        const res = await fetch(`${API_BASE}/products/group/${productGroup}`);
        const data = await res.json();

        if (data.success) {
          console.log(`✅ Fetched ${data.data.length} products for SO group:`, productGroup);
          setFilteredProducts(data.data);
        } else if (Array.isArray(data)) {
          // Handle if API returns array directly
          console.log(`✅ Fetched ${data.length} products for SO group:`, productGroup);
          setFilteredProducts(data);
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
  }, [productGroup]);

  // Fetch products for SAMPLE PRODUCTS section when sampleProductGroup changes
  useEffect(() => {
    if (!sampleProductGroup) {
      setFilteredSampleProducts([]);
      return;
    }

    const fetchSampleProductsByGroup = async () => {
      setLoadingSampleProducts(true);
      try {
        const res = await fetch(`${API_BASE}/products/group/${sampleProductGroup}`);
        const data = await res.json();

        if (data.success) {
          console.log(`✅ Fetched ${data.data.length} products for sample group:`, sampleProductGroup);
          setFilteredSampleProducts(data.data);
        } else if (Array.isArray(data)) {
          console.log(`✅ Fetched ${data.length} products for sample group:`, sampleProductGroup);
          setFilteredSampleProducts(data);
        } else {
          console.warn("⚠️ Failed to fetch sample products:", data.message);
          setFilteredSampleProducts([]);
        }
      } catch (error) {
        console.error("❌ Error fetching sample products by group:", error);
        setFilteredSampleProducts([]);
        toast.error("Failed to load sample products");
      } finally {
        setLoadingSampleProducts(false);
      }
    };

    fetchSampleProductsByGroup();
  }, [sampleProductGroup]);

  // Fetch available qty for all filtered products
  useEffect(() => {
    if (filteredProducts.length === 0) {
      setAvailableQtyCache({});
      return;
    }

    const fetchAvailableQtyForAll = async () => {
      const newCache = {};

      for (const product of filteredProducts) {
        try {
          const res = await fetch(`${API_BASE}/products/available/${product._id}`);
          const data = await res.json();
          newCache[product._id] = data.data?.availableQty || 0;
        } catch (err) {
          console.error(`Failed to fetch available qty for ${product._id}:`, err);
          // Fallback to totalQty from product if available
          newCache[product._id] = product.totalQty || 0;
        }
      }

      setAvailableQtyCache(newCache);
    };

    fetchAvailableQtyForAll();
  }, [filteredProducts]);

  const filteredProducts_unused = useMemo(() => {
    return productGroup
      ? products.filter((p) => {
          const pGroupId = p.productGroup?._id || p.productGroup || p.groupId?._id || p.groupId;
          return String(pGroupId) === String(productGroup);
        })
      : [];
  }, [products, productGroup]);

  // Debug: Log filtered products when group changes
  useEffect(() => {
    if (productGroup && filteredProducts.length > 0) {
      console.log(`✅ Found ${filteredProducts.length} products for SO group:`, productGroup);
    } else if (productGroup) {
      console.warn(`⚠️ No products found for SO group: ${productGroup}`);
      console.log("Available products (from API):", filteredProducts);
    }
  }, [filteredProducts, productGroup]);

  const productsWithStock = useMemo(() => {
    return filteredProducts.map((p) => {
      // 1️⃣ Get HSN from product database first
      let hsn = p.hsnCode || "";

      // 2️⃣ Fallback to purchase order HSN if product doesn't have it
      if (!hsn) {
        const poItem = poItems.find(
          (item) => String(item.productId || item.productId?._id) === String(p._id)
        );
        hsn = poItem?.hsn || "";
      }

      return {
        ...p,
        // Use product database fields directly
        availableQty: p.totalQty || 0,
        sellingPrice: p.sellingPrice || 0,
        gst: p.gst || 0,
        hsn,
      };
    });
  }, [filteredProducts, poItems]);



  const handleItemSelection = (id) => {
    const product = productsWithStock.find(p => p._id === id);
    if (!product) return;

    setSelectedItem(id);
    setItemSearch(product.name);
    setShowItemDropdown(false);
    setQty(1);

    // ✅ AUTO-FILL (WITH CUSTOMER MARGIN APPLIED)
    const basePrice = product.sellingPrice;
    const adjustedPrice = basePrice + (basePrice * Number(customerMargin)) / 100;
    setSellingPrice(adjustedPrice);
    setGst(product.gst);

    setCgst(product.gst / 2);
    setSgst(product.gst / 2);
    setIgst(false);
    setHsn(product.hsn);

    if (customerId) {
      fetchRecentOrders(customerId, id);
    }
  };


  const handleCustomerSelect = (id) => {
    setCustomerId(id);
    const customer = fetchedCustomers.find(c => c._id === id) || customers.find(c => c._id === id);
    setSelectedCustomer(customer || null);
    
    // Set search to customer name and hide dropdown
    setCustomerSearch(customer?.name || "");
    setShowCustomerDropdown(false);
    
    // Extract sales owner name from object or use string, and store ID
    const ownerData = customer?.salesOwner;
    let ownerName = "";
    let ownerId = "";
    
    if (typeof ownerData === "object" && ownerData?._id) {
      ownerName = ownerData.name || "";
      ownerId = ownerData._id;
    } else if (typeof ownerData === "string") {
      ownerName = ownerData;
      ownerId = ownerData;
    }
    
    setSalesOwner(ownerName);
    setSalesOwnerId(ownerId);
    setCustomerMargin(customer?.margin || 0);

    setTransportCharge(0);

    // Fetch recent orders for selected customer + selected item
    if (selectedItem) {
      fetchRecentOrders(id, selectedItem);
    }
  };


  const displayPrice = useMemo(() => {
    const base = sellingPrice * qty;

    const discountAmount =
      discountType === "PERCENT"
        ? (base * discountPercent) / 100
        : discountAmountInput;

    const safeDiscount = Math.min(discountAmount, base);
    const taxable = base - safeDiscount;
    const tax = (taxable * gst) / 100;

    return taxable + tax;
  }, [sellingPrice, qty, gst, discountType, discountPercent, discountAmountInput]);


  const addItem = () => {
    if (!selectedItem) {
      toast.warning("Select item");
      return;
    }

    const p = productsWithStock.find((x) => x._id === selectedItem);
    if (!p) {
      toast.error("Product not found. Please select again.");
      return;
    }

    // 1️⃣ CALCULATE ADJUSTED SELLING PRICE WITH CUSTOMER MARGIN
    const basSellingPrice = Number(sellingPrice);
    const adjustedSellingPrice = basSellingPrice + (basSellingPrice * Number(customerMargin)) / 100;

    // 2️⃣ BASE AMOUNT (using adjusted selling price)
    const baseAmount = adjustedSellingPrice * Number(qty);

    // 2️⃣ DISCOUNT (₹ or %)
    const calculatedDiscount =
      discountType === "PERCENT"
        ? (baseAmount * Number(discountPercent)) / 100
        : Number(discountAmountInput);

    const discountAmount = Math.min(calculatedDiscount, baseAmount);

    // 3️⃣ TAXABLE AMOUNT
    const taxableAmount = baseAmount - discountAmount;

    // 4️⃣ GST AMOUNT
    const taxAmount = (taxableAmount * Number(gst)) / 100;

    // 5️⃣ GST BREAKUP
    const taxBreakup = igst
      ? {
        igst: Number(gst),
        cgst: 0,
        sgst: 0,
      }
      : {
        igst: 0,
        cgst: Number(gst) / 2,
        sgst: Number(gst) / 2,
      };

    // 6️⃣ FINAL TOTAL (ITEM LEVEL)
    const totalAmount = taxableAmount + taxAmount;

    // 7️⃣ PUSH ITEM (using adjusted selling price with customer margin)
    setItems((prev) => [
      ...prev,
      {
        productId: p._id,
        name: p.name,
        hsn,
        qty: Number(qty),
        sellingPrice: Number(adjustedSellingPrice),

        baseAmount,
        discountType,
        discountPercent: Number(discountPercent),
        discountAmount,

        taxableAmount,
        gst: Number(gst),
        ...taxBreakup,
        taxAmount,

        total: totalAmount,
      },
    ]);

    // 8️⃣ RESET FORM
    setSelectedItem("");
    setSellingPrice(0);
    setQty(1);
    setDiscountPercent(0);
    setDiscountAmountInput(0);
    setGst(0);
    setIgst(false);
    setHsn("");
  };

  const removeItem = (i) => {
    setItems(items.filter((_, idx) => idx !== i));
  };

  // SAMPLE PRODUCTS - Add item
  const handleSampleItemSelection = (id) => {
    const product = filteredSampleProducts.find(p => p._id === id);
    if (!product) return;

    setSampleSelectedItem(id);
    setSampleItemSearch(product.name);
    setShowSampleItemDropdown(false);
    setSampleQty(1);
    setSampleSellingPrice(product.sellingPrice);
  };

  const addSampleItem = () => {
    if (!sampleSelectedItem) {
      toast.warning("Select sample item");
      return;
    }

    const p = filteredSampleProducts.find((x) => x._id === sampleSelectedItem);
    if (!p) {
      toast.error("Product not found. Please select again.");
      return;
    }

    setSampleItems((prev) => [
      ...prev,
      {
        productId: p._id,
        name: p.name,
        hsn: p.hsnCode || "",
        qty: Number(sampleQty),
        sellingPrice: Number(sampleSellingPrice),
        isSample: true,
      },
    ]);

    toast.success(`${p.name} added as sample!`);

    setSampleSelectedItem("");
    setSampleItemSearch("");
    setSampleQty(1);
    setSampleSellingPrice(0);
  };

  const removeSampleItem = (i) => {
    setSampleItems(sampleItems.filter((_, idx) => idx !== i));
  };

  const subtotal = items.reduce(
    (s, i) => s + i.qty * i.sellingPrice,
    0
  );

  const totalDiscount = items.reduce(
    (sum, item) => sum + (item.discountAmount || 0),
    0
  );

  const totalTax = items.reduce((s, i) => {
    const base = i.qty * i.sellingPrice;
    const taxable = base - (i.discountAmount || 0);
    return s + (taxable * i.gst) / 100;
  }, 0);

  const grandTotal =
    subtotal - totalDiscount + totalTax + Number(transportCharge || 0);


  // Round up all item totals and financial values
  const roundedItems = items.map((item) => ({
    ...item,
    total: Math.ceil(item.total * 100) / 100,
  }));

  const roundedSubtotal = Math.ceil(subtotal * 100) / 100;
  const roundedTotalDiscount = Math.ceil(totalDiscount * 100) / 100;
  const roundedTotalTax = Math.ceil(totalTax * 100) / 100;
  const roundedTransportCharge = Math.ceil(Number(transportCharge || 0) * 100) / 100;
  const roundedGrandTotal = Math.ceil(grandTotal * 100) / 100;

  const payload = {
    voucherType,
    customer: selectedCustomer
      ? {
        id: selectedCustomer._id,
        name: selectedCustomer.name,
        whatsapp: selectedCustomer.whatsapp,
        address: selectedCustomer.address,
        district: selectedCustomer.district,
        state: selectedCustomer.state,
        pincode: selectedCustomer.pincode,

        gstin: selectedCustomer.gstin,
        openingBalance: selectedCustomer.totalBalance,
        balanceType: selectedCustomer.balanceType,
      }
      : null,


    warehouse,

    items: roundedItems,
    sampleItems: sampleItems,
    transportCharge: roundedTransportCharge,
    subtotal: roundedSubtotal,
    totalDiscount: roundedTotalDiscount,
    totalTax: roundedTotalTax,
    grandTotal: roundedGrandTotal,
    ewayEnabled: enableEway,
    ewayDetails: enableEway
      ? {
        ewayBillNo,
        ewayDate,
        vehicleNo,
        transportMode,
        transporterName,
      }
      : null,
    salesOwner: salesOwnerId,
    salesMan,
    deliveryMan,
    billingPerson,
  };

  const handleFinalAction = async () => {
    if (!voucherType || !warehouse || items.length === 0) {
      return toast.error("Fill all required fields");
    }

    if (!customerId) {
      return toast.error("Please select a customer");
    }

    try {
      const res = await fetch(`${API_BASE}/sales-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message);

      toast.success(`Sales Order Created: ${data.invoiceId}`);
      // NOTE: Customer balance will be updated after invoice generation, not here

      setInvoiceId(data.invoiceId);
    } catch (err) {
      toast.error(err.message || "Failed to save Sales Order");
    }
  };



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
                grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>Voucher Type</label>
          <select className={selectClass} value={voucherType} onChange={(e) => setVoucherType(e.target.value)}>
            <option value="">-- Select --</option>
            {voucherTypes.map((v) => (
              <option key={v._id} value={v.name}>{v.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Invoice ID</label>
          <input className={`${inputClass} bg-gray-50 font-bold text-[#319bab]`} value={invoiceId} readOnly />
        </div>

        <div>
          <label className={labelClass}>Warehouse</label>
          <select className={selectClass} value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
            <option value="">-- Select --</option>
            {warehouses.map((w) => (
              <option key={w._id} value={w.name}>{w.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
        <h3 className="text-[#319bab] font-black uppercase text-xs tracking-widest">
          Customer Details
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 relative">
          <label className={labelClass}>Customer</label>
          <input
            type="text"
            placeholder="Type to search or click to see all customers..."
            value={customerSearch}
            onChange={(e) => {
              setCustomerSearch(e.target.value);
              setShowCustomerDropdown(true);
            }}
            onFocus={() => setShowCustomerDropdown(true)}
            className={inputClass}
          />
          
          {/* CUSTOMER DROPDOWN */}
          {showCustomerDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
              {searchingCustomers && (
                <div className="px-3 py-2 text-gray-500 text-sm text-center">🔍 Searching...</div>
              )}
              {!searchingCustomers && fetchedCustomers
                .map((c) => (
                  <div
                    key={c._id}
                    onClick={() => handleCustomerSelect(c._id)}
                    className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b text-sm"
                  >
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-gray-500 text-xs">{c.whatsapp}</div>
                  </div>
                ))}
              {!searchingCustomers && fetchedCustomers.length === 0 && customerSearch && (
                <div className="px-3 py-2 text-gray-500 text-sm">No customers found for "{customerSearch}"</div>
              )}
              {!searchingCustomers && fetchedCustomers.length === 0 && !customerSearch && (
                <div className="px-3 py-2 text-gray-500 text-sm">Loading customers...</div>
              )}
            </div>
          )}
        </div>

          <div>
            <label className={labelClass}>GSTIN</label>
            <input
              className={inputClass}
              value={selectedCustomer?.gstin || ""}
              readOnly
            />
          </div>

          <div>
            <label className={labelClass}>Closing Balance</label>
            <input
              className={`${inputClass} font-bold ${selectedCustomer?.closingBalance && selectedCustomer.closingBalance > 0
                ? "text-blue-600"
                : "text-gray-600"
                }`}
              value={
                selectedCustomer
                  ? `₹${selectedCustomer.closingBalance?.toFixed(2)}`
                  : ""
              }
              readOnly
            />
          </div>

          <div>
            <label className={labelClass}>WhatsApp</label>
            <input className={inputClass} value={selectedCustomer?.whatsapp || ""} readOnly />
          </div>

          <div>
            <label className={labelClass}>Sales Owner</label>
            <input 
              className={`${inputClass} bg-gray-100`} 
              value={salesOwner || ""} 
              readOnly 
            />
          </div>

          <div>
            <label className={labelClass}>Email</label>
            <input className={inputClass} value={selectedCustomer?.email || ""} readOnly />
          </div>

          <div className="md:col-span-2">
            <label className={labelClass}>Address</label>
            <textarea
              className={`${inputClass} h-16`}
              value={selectedCustomer?.address || ""}
              readOnly
            />
          </div>

          <div>
            <label className={labelClass}>District</label>
            <input className={inputClass} value={selectedCustomer?.district || ""} readOnly />
          </div>

          <div>
            <label className={labelClass}>State</label>
            <input className={inputClass} value={selectedCustomer?.state || ""} readOnly />
          </div>

          <div>
            <label className={labelClass}>Pincode</label>
            <input className={inputClass} value={selectedCustomer?.pincode || ""} readOnly />
          </div>
        </div>
      </div>

      {/* PRODUCT GROUP */}
      <div className="relative">
        <label className={labelClass}>Product Group</label>
        <input
          type="text"
          placeholder="Type product group name..."
          value={productGroupSearch}
          onChange={(e) => {
            setProductGroupSearch(e.target.value);
            setShowProductGroupDropdown(true);
          }}
          onFocus={() => setShowProductGroupDropdown(true)}
          className={inputClass}
        />
        
        {/* PRODUCT GROUP DROPDOWN */}
        {showProductGroupDropdown && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
            {productGroups
              .filter(g => 
                g.name.toLowerCase().includes(productGroupSearch.toLowerCase())
              )
              .map((g) => (
                <div
                  key={g._id}
                  onClick={() => {
                    setProductGroup(g._id);
                    setProductGroupSearch(g.name);
                    setShowProductGroupDropdown(false);
                    setSelectedItem("");
                    setItemSearch("");
                  }}
                  className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b text-sm font-semibold"
                >
                  {g.name}
                </div>
              ))}
            {productGroups.filter(g => 
              g.name.toLowerCase().includes(productGroupSearch.toLowerCase())
            ).length === 0 && (
              <div className="px-3 py-2 text-gray-500 text-sm">No product groups found</div>
            )}
          </div>
        )}
      </div>

      {/* ITEM ENTRY */}
      <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 space-y-4">

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <label className={labelClass}>Item Name</label>
            <input
              type="text"
              placeholder="Type item name..."
              value={itemSearch}
              onChange={(e) => {
                setItemSearch(e.target.value);
                setShowItemDropdown(true);
              }}
              onFocus={() => setShowItemDropdown(true)}
              disabled={!productGroup || !warehouse}
              className={`${inputClass} ${(!productGroup || !warehouse) ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            />
            
            {/* ITEM DROPDOWN */}
            {showItemDropdown && productGroup && warehouse && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                {productsWithStock
                  .filter(p => 
                    p.name.toLowerCase().includes(itemSearch.toLowerCase()) &&
                    (availableQtyCache[p._id] || p.availableQty || 0) > 0
                  )
                  .map((p) => (
                    <div
                      key={p._id}
                      onClick={() => handleItemSelection(p._id)}
                      className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b text-sm"
                    >
                      <div className="font-semibold">{p.name} ({p.perQty || 1}:{p.units || ""})</div>
                      <div className="text-gray-500 text-xs">Available: {availableQtyCache[p._id] ?? p.availableQty ?? 0}</div>
                    </div>
                  ))}
                {productsWithStock.filter(p => 
                  p.name.toLowerCase().includes(itemSearch.toLowerCase()) &&
                  (availableQtyCache[p._id] || p.availableQty || 0) > 0
                ).length === 0 && (
                  <div className="px-3 py-2 text-gray-500 text-sm">
                    {productsWithStock.length === 0 ? "Select Product Group first" : "No items found"}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className={labelClass}>HSN</label>
            <input className={inputClass} value={hsn} readOnly />
          </div>

          <div>
            <label className={labelClass}>Selling ₹</label>
            <input type="number" className={inputClass} value={sellingPrice} onChange={(e) => setSellingPrice(+e.target.value)} />
          </div>

          <div>
            <label className={labelClass}>Qty</label>
            <input
              type="number"
              className={inputClass}
              value={qty}
              min={1}
              max={
                availableQtyCache[selectedItem] ?? 
                productsWithStock.find(p => p._id === selectedItem)?.availableQty ?? 1
              }
              onChange={(e) => setQty(+e.target.value)}
            />

          </div>

          <div>
            <label className={labelClass}>GST %</label>
            <input type="number" className={inputClass} value={gst} onChange={(e) => setGst(+e.target.value)} />
          </div>

          <div>
            <label className={labelClass}>Discount Type</label>
            <select
              className={selectClass}
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value)}
            >
              <option value="PERCENT">%</option>
              <option value="AMOUNT">₹</option>
            </select>
          </div>

          {discountType === "PERCENT" ? (
            <div>
              <label className={labelClass}>Discount %</label>
              <input
                type="number"
                className={inputClass}
                value={discountPercent}
                min="0"
                max="100"
                onChange={(e) => setDiscountPercent(+e.target.value)}
              />
            </div>
          ) : (
            <div>
              <label className={labelClass}>Discount ₹</label>
              <input
                type="number"
                className={inputClass}
                value={discountAmountInput}
                min="0"
                onChange={(e) => setDiscountAmountInput(+e.target.value)}
              />
            </div>
          )}

          <div>
            <label className={labelClass}>Total ₹</label>
            <input className={`${inputClass} font-bold text-[#319bab]`} value={displayPrice.toFixed(2)} readOnly />
          </div>

          <div className="md:col-span-4 flex items-end pt-2">
            <button onClick={addItem} className="w-full bg-[#319bab] text-white h-[42px] rounded-xl font-bold flex items-center justify-center hover:bg-[#257f87] transition shadow-lg cursor-pointer active:scale-95">
              <FaPlus className="mr-2" /> ADD ITEM
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs font-bold text-gray-600">
            <input type="checkbox" checked={igst} onChange={(e) => setIgst(e.target.checked)} /> IGST
          </label>
          {!igst && (
            <>
              <span className="text-xs font-bold text-gray-600">CGST {gst / 2}%</span>
              <span className="text-xs font-bold text-gray-600">SGST {gst / 2}%</span>
            </>
          )}
        </div>

      </div>


      {/* SAMPLE PRODUCTS SECTION */}
      <div className="bg-yellow-50 border-2 border-yellow-200 p-6 rounded-2xl space-y-4">
        <h3 className="text-yellow-700 font-black uppercase text-sm tracking-widest">
          🎁 Sample Products (Not Billed)
        </h3>
        <p className="text-xs text-yellow-600">Sample products are tracked but do not affect the bill total</p>

        {/* SAMPLE ITEM ENTRY */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div>
            <label className={labelClass}>Product Group</label>
            <select className={selectClass} value={sampleProductGroup} onChange={(e) => setSampleProductGroup(e.target.value)}>
              <option value="">Select Group</option>
              {productGroups.map((g) => (
                <option key={g._id} value={g._id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <label className={labelClass}>Item</label>
            <input
              type="text"
              placeholder="Type item name..."
              value={sampleItemSearch}
              onChange={(e) => {
                setSampleItemSearch(e.target.value);
                setShowSampleItemDropdown(true);
              }}
              onFocus={() => setShowSampleItemDropdown(true)}
              disabled={!sampleProductGroup}
              className={`${inputClass} ${!sampleProductGroup ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            />
            {showSampleItemDropdown && sampleProductGroup && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto">
                {loadingSampleProducts && (
                  <div className="px-3 py-2 text-gray-500 text-sm text-center">🔍 Loading products...</div>
                )}
                {!loadingSampleProducts && filteredSampleProducts
                  .filter(p => p.name.toLowerCase().includes(sampleItemSearch.toLowerCase()) && p.totalQty > 0)
                  .map((p) => (
                    <div
                      key={p._id}
                      onClick={() => handleSampleItemSelection(p._id)}
                      className="px-3 py-2 hover:bg-yellow-50 cursor-pointer border-b text-sm"
                    >
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-gray-500 text-xs">Available: {p.totalQty || 0}</div>
                    </div>
                  ))}
                {!loadingSampleProducts && filteredSampleProducts.filter(p => p.name.toLowerCase().includes(sampleItemSearch.toLowerCase()) && p.totalQty > 0).length === 0 && (
                  <div className="px-3 py-2 text-gray-500 text-sm">No products available</div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className={labelClass}>Qty</label>
            <input
              type="number"
              className={inputClass}
              value={sampleQty}
              onChange={(e) => setSampleQty(+e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass}>Price ₹</label>
            <input
              type="number"
              className={inputClass}
              value={sampleSellingPrice}
              onChange={(e) => setSampleSellingPrice(+e.target.value)}
            />
          </div>

          <button onClick={addSampleItem} className="bg-yellow-500 text-white h-[42px] rounded-xl font-bold flex items-center justify-center hover:bg-yellow-600 transition shadow-lg active:scale-95">
            <FaPlus className="mr-2" /> ADD SAMPLE
          </button>
        </div>
      </div>

      {/* SAMPLE ITEMS TABLE */}
      {sampleItems.length > 0 && (
        <div className="bg-yellow-50 rounded-2xl shadow-sm border-2 border-yellow-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-yellow-100 text-yellow-700 uppercase text-[11px] font-bold">
              <tr>
                <th className="px-4 py-3 text-left">Sample Item</th>
                <th className="px-4 py-3 text-center">Qty</th>
                <th className="px-4 py-3 text-right">Unit Price</th>
                <th className="px-4 py-3 text-right">Total (Qty × Price)</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sampleItems.map((item, index) => (
                <tr key={index} className="bg-yellow-50 hover:bg-yellow-100">
                  <td className="px-4 py-3 font-semibold text-yellow-900">
                    {item.name}
                    <div className="text-[10px] text-yellow-700">HSN: {item.hsn}</div>
                  </td>
                  <td className="px-4 py-3 text-center font-bold">{item.qty}</td>
                  <td className="px-4 py-3 text-right text-yellow-600">₹{item.sellingPrice.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-yellow-700 font-bold">₹{(item.qty * item.sellingPrice).toFixed(2)}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => removeSampleItem(index)} className="text-red-500 hover:text-red-700">
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TABLE */}
      {items.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-[11px] font-bold">
              <tr>
                <th className="px-4 py-3 text-left">Item</th>
                <th className="px-4 py-3 text-center">Qty</th>
                <th className="px-4 py-3 text-right">Rate</th>
                <th className="px-4 py-3 text-right">Discount</th>
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
                    <div className="text-[10px] text-gray-400">HSN: {item.hsn}</div>
                  </td>
                  <td className="px-4 py-3 text-center">{item.qty}</td>
                  <td className="px-4 py-3 text-right">₹{item.sellingPrice}</td>
                  <td className="px-4 py-3 text-right text-red-500">
                    ₹{item.discountAmount.toFixed(2)}
                  </td>


                  <td className="px-4 py-3 text-right">
                    {item.igst
                      ? `IGST ${item.gst}%`
                      : `CGST ${item.cgst}% + SGST ${item.sgst}%`}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-[#319bab]">₹{item.total.toFixed(2)}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700">
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}





      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4 mt-6">
        <div className="flex items-center justify-between">
          <h3 className="text-[#319bab] font-black uppercase text-xs tracking-widest">
            E-Way Bill Details
          </h3>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={enableEway}
              onChange={(e) => setEnableEway(e.target.checked)}
            />
            <span className="text-xs font-bold text-gray-600">
              Enable E-Way
            </span>
          </div>
        </div>

        {enableEway && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className={labelClass}>E-Way Bill No</label>
              <input
                type="text"
                className={inputClass}
                value={ewayBillNo}
                onChange={(e) => setEwayBillNo(e.target.value)}
                placeholder="Enter E-Way No"
              />
            </div>

            <div>
              <label className={labelClass}>E-Way Date</label>
              <input
                type="date"
                className={inputClass}
                value={ewayDate}
                onChange={(e) => setEwayDate(e.target.value)}
              />
            </div>

            <div>
              <label className={labelClass}>Vehicle No</label>
              <input
                type="text"
                className={inputClass}
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value)}
                placeholder="TN09AB1234"
              />
            </div>

            <div>
              <label className={labelClass}>Transport Mode</label>
              <select
                className={selectClass}
                value={transportMode}
                onChange={(e) => setTransportMode(e.target.value)}
              >
                <option value="Road">Road</option>
                <option value="Rail">Rail</option>
                <option value="Air">Air</option>
                <option value="Ship">Ship</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Transporter</label>
              <input
                type="text"
                className={inputClass}
                value={transporterName}
                onChange={(e) => setTransporterName(e.target.value)}
                placeholder="ABC Logistics"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center text-sm">
        <span className="text-gray-500">Transport Charge</span>
        <input
          type="number"
          min="0"
          className="w-32 border border-gray-300 rounded-lg px-2 py-1 text-right font-bold"
          value={transportCharge}
          onChange={(e) => setTransportCharge(+e.target.value || 0)}
        />
      </div>

      {/* Sales Man, Delivery Man, and Billing Person */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>Sales Man</label>
          <select
            className={selectClass}
            value={salesMan}
            onChange={(e) => setSalesMan(e.target.value)}
          >
            <option value="">-- Select Sales Man --</option>
            {salesMen.map((sm) => (
              <option key={sm._id} value={sm._id}>
                {sm.name} ({sm.phone})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Delivery Man</label>
          <select
            className={selectClass}
            value={deliveryMan}
            onChange={(e) => setDeliveryMan(e.target.value)}
          >
            <option value="">-- Select Delivery Man --</option>
            {deliveryMen.map((dm) => (
              <option key={dm._id} value={dm._id}>
                {dm.name} ({dm.phone})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Billing Person</label>
          <select
            className={selectClass}
            value={billingPerson}
            onChange={(e) => setBillingPerson(e.target.value)}
          >
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


      {/* SUMMARY */}
      <div className="bg-white p-6 rounded-3xl shadow-xl border border-primary/5 h-fit sticky top-24">
        <h3 className="text-[#319bab] font-black uppercase text-xs tracking-widest mb-6 border-b pb-2 border-[#319bab]/30">
          Order Summary
        </h3>

        <div className="space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span className="font-bold">₹{subtotal.toFixed(2)}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Discount</span>
            <span className="font-bold text-red-500">
              -₹{totalDiscount.toFixed(2)}
            </span>
          </div>


          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Tax Amount</span>
            <span className="font-bold">₹{totalTax.toFixed(2)}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Transport</span>
            <span className="font-bold">₹{Number(transportCharge || 0).toFixed(2)}</span>
          </div>

          {sampleItems.length > 0 && (
            <div className="pt-2 border-t border-yellow-200 mt-2">
              <div className="flex justify-between text-xs text-yellow-700 font-semibold">
                <span>📦 Sample Items: {sampleItems.reduce((s, i) => s + i.qty, 0)} units (Not in total)</span>
              </div>
            </div>
          )}

          <div className="pt-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-800 font-black text-xs uppercase">
                Grand Total
              </span>
              <span className="text-3xl font-black text-[#319bab] italic">
                ₹{roundedGrandTotal.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 mt-8">
            <button onClick={handleFinalAction} className="w-full bg-[#319bab] text-white py-3 rounded-xl font-bold uppercase text-[10px] hover:bg-[#257f87] transition">
              Place Sales Order
            </button>
          </div>
        </div>
      </div>
      {/* RIGHT SIDE RECENT ORDERS PANEL */}
      {showRecentPanel && recentOrders.length > 0 && (
        <div className="
    hidden lg:flex
    fixed top-24 right-4 z-40
    w-96 max-h-[70vh]
    bg-white rounded-2xl
    shadow-2xl border border-gray-200
    flex-col
  ">
          {/* HEADER */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h4 className="text-[#319bab] font-black text-xs uppercase tracking-widest">
              Recent Orders
            </h4>
            <button
              onClick={() => setShowRecentPanel(false)}
              className="text-gray-400 hover:text-red-500 text-lg font-bold"
            >
              ×
            </button>
          </div>

          {/* SCROLLABLE BODY */}
          <div className="overflow-y-auto px-4 py-2">
            <table className="w-full text-sm">
              <thead className="text-gray-500 text-[10px] uppercase font-bold sticky top-0 bg-white">
                <tr>
                  <th className="text-left py-1">Invoice</th>
                  <th className="text-center">Selling price</th>
                  <th className="text-center">Qty</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => {
                  const item = order.items.find(
                    i => String(i.productId) === String(selectedItem)
                  );

                  return (
                    <tr key={order._id} className="border-t text-xs">
                      <td className="py-1 font-semibold">
                        {order.invoiceId}
                      </td>
                      <td className="text-center">
                        {item?.sellingPrice}
                      </td>
                      <td className="text-center">
                        {item?.qty}
                      </td>
                      <td className="text-right text-[#319bab] font-bold">
                        ₹{item?.total.toFixed(2)}
                      </td>
                      <td className="text-right text-gray-700">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>

  );
}
