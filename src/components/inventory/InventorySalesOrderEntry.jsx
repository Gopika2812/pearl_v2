import { useEffect, useMemo, useState, useRef } from "react";
import { FaPlus, FaTrash } from "react-icons/fa";
import { ToastContainer, toast } from "react-toastify";
import { API_BASE } from "../../api";

const inputClass =
  "w-full border border-gray-200 rounded-md px-3 py-1.5 focus:ring-1 focus:ring-[#319bab] outline-none text-xs";
const selectClass =
  "w-full border border-gray-200 rounded-md px-3 py-1.5 bg-white focus:ring-1 focus:ring-[#319bab] outline-none text-xs appearance-none";
const labelClass =
  "block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-tight";


export default function InventorySalesOrderEntry({
  voucherTypes = [],
  warehouses = [],
  products = [],
  productGroups = [],
  customers = [],
  salesMen = [],
  deliveryMen = [],
  salesOwners = [],
  customerGroups = [],
  branchId = ""
}) {
  const [voucherType, setVoucherType] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [warehouse, setWarehouse] = useState("");


  const [productGroup, setProductGroup] = useState("");
  const [selectedItem, setSelectedItem] = useState("");
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [sellingPrice, setSellingPrice] = useState(0);
  const [qty, setQty] = useState("");
  const [gst, setGst] = useState(0);
  const [cgst, setCgst] = useState(0);
  const [sgst, setSgst] = useState(0);
  const [igst, setIgst] = useState(false);
  const [hsn, setHsn] = useState("");

  const [items, setItems] = useState([]);
  const [sampleItems, setSampleItems] = useState([]);

  const [sampleProductGroup, setSampleProductGroup] = useState("");
  const [sampleSelectedItem, setSampleSelectedItem] = useState("");
  const [sampleQty, setSampleQty] = useState("");
  const [sampleSellingPrice, setSampleSellingPrice] = useState(0);
  const [sampleItemSearch, setSampleItemSearch] = useState("");
  const [showSampleItemDropdown, setShowSampleItemDropdown] = useState(false);
  const [filteredSampleProducts, setFilteredSampleProducts] = useState([]);
  const [loadingSampleProducts, setLoadingSampleProducts] = useState(false);
  const [availableQtyCache, setAvailableQtyCache] = useState({});



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

  // EXTRA EXPENSES STATES
  const [extraExpenses, setExtraExpenses] = useState([]);
  const [showExtraExpensesModal, setShowExtraExpensesModal] = useState(false);
  const [expenseName, setExpenseName] = useState("");
  const [expensePrice, setExpensePrice] = useState("");

  // SEARCH STATES FOR TYPING
  const [customerSearch, setCustomerSearch] = useState("");
  const [productGroupSearch, setProductGroupSearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showProductGroupDropdown, setShowProductGroupDropdown] = useState(false);
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [fetchedCustomers, setFetchedCustomers] = useState([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // REFS FOR CLICK OUTSIDE
  const itemDropdownRef = useRef(null);
  const customerDropdownRef = useRef(null);
  const productGroupDropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (itemDropdownRef.current && !itemDropdownRef.current.contains(event.target)) {
        setShowItemDropdown(false);
      }
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target)) {
        setShowCustomerDropdown(false);
      }
      if (productGroupDropdownRef.current && !productGroupDropdownRef.current.contains(event.target)) {
        setShowProductGroupDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!voucherType) {
      setInvoiceId("");
      // Reset product selection when voucher type changes
      setProductGroup("");
      setProductGroupSearch("");
      setSelectedItem("");
      setItemSearch("");
      setQty("");
      setItems([]);
      return;
    }

    const fetchPreview = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/sales-orders/preview/${voucherType}?branchId=${branchId}`
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
    setQty("");
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
          `${API_BASE}/customers?search=${encodeURIComponent(customerSearch)}&branchId=${branchId}&limit=100`
        );
        const data = await res.json();

        if (!res.ok) {
          console.error("🔴 Customer search failed:", data.message);
          setFetchedCustomers([]);
          return;
        }

        // API returns { success: true, data: [...], pagination: {...} }
        const customerList = Array.isArray(data.data) ? data.data : [];
        setFetchedCustomers(customerList);
      } catch (err) {
        console.error("❌ Failed to search customers:", err);
        setFetchedCustomers([]);
      } finally {
        setSearchingCustomers(false);
      }
    };

    const timer = setTimeout(fetchCustomersFromBackend, 300); // Debounce 300ms
    return () => clearTimeout(timer);
  }, [customerSearch, branchId]);

  // Initialize with provided customers on mount
  useEffect(() => {
    setFetchedCustomers(customers);
  }, []);


  // Reset items when warehouse changes
  useEffect(() => {
    setSelectedItem("");
    setItemSearch("");
    setQty("");
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
      setFilteredProducts(products); // Use all products if no group
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
  }, [productGroup, products]);

  // Fetch products for SAMPLE PRODUCTS section when sampleProductGroup changes
  useEffect(() => {
    if (!sampleProductGroup) {
      setFilteredSampleProducts(products); // Use all products if no group
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
  }, [sampleProductGroup, products]);

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

    // Auto-select Product Group if not already selected or if different
    const pGroupId = product.productGroup?._id || product.productGroup || product.groupId?._id || product.groupId;
    if (pGroupId && pGroupId !== productGroup) {
      setProductGroup(pGroupId);
      const groupObj = productGroups.find((g) => g._id === pGroupId);
      if (groupObj) {
        setProductGroupSearch(groupObj.name);
      }
    }

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

    // Fetch recent orders for selected customer + selected item
    if (selectedItem) {
      fetchRecentOrders(id, selectedItem);
    }
  };


  const displayPrice = useMemo(() => {
    const base = sellingPrice * (Number(qty) || 0);

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
    if (!qty || Number(qty) <= 0) {
      toast.warning("Quantity must be greater than 0");
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
    setItemSearch("");
    setSellingPrice(0);
    setQty("");
    setDiscountPercent(0);
    setDiscountAmountInput(0);
    setGst(0);
    setIgst(false);
    setHsn("");
    setShowItemDropdown(false);
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

    // Auto-select Product Group for sample item
    const pGroupId = product.productGroup?._id || product.productGroup || product.groupId?._id || product.groupId;
    if (pGroupId && pGroupId !== sampleProductGroup) {
      setSampleProductGroup(pGroupId);
    }
    setSampleQty(1);
    setSampleSellingPrice(product.sellingPrice);
  };

  const addSampleItem = () => {
    if (!sampleSelectedItem) {
      toast.warning("Select sample item");
      return;
    }
    if (!sampleQty || Number(sampleQty) <= 0) {
      toast.warning("Sample quantity must be greater than 0");
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
    setSampleQty("");
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

  // Calculate extra expenses total
  const extraExpenseAmount = extraExpenses.reduce(
    (sum, exp) => sum + exp.totalPrice,
    0
  );

  const grandTotal =
    subtotal - totalDiscount + totalTax + extraExpenseAmount;


  // Round up all item totals and financial values
  const roundedItems = items.map((item) => ({
    ...item,
    total: Math.ceil(item.total * 100) / 100,
  }));

  const roundedSubtotal = Math.ceil(subtotal * 100) / 100;
  const roundedTotalDiscount = Math.ceil(totalDiscount * 100) / 100;
  const roundedTotalTax = Math.ceil(totalTax * 100) / 100;
  const roundedExtraExpenseAmount = Math.ceil(extraExpenseAmount * 100) / 100;

  // 📊 CALCULATE MARGIN AMOUNT (margin already applied to item prices)
  const marginAmount = customerMargin > 0
    ? Math.ceil((roundedSubtotal * customerMargin) / (100 + customerMargin) * 100) / 100
    : 0;

  const roundedGrandTotal = Math.round(grandTotal);
  const grandTotalWithMargin = Math.round(roundedGrandTotal + marginAmount);

  const payload = {
    branchId,
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
    subtotal: roundedSubtotal,
    totalDiscount: roundedTotalDiscount,
    totalTax: roundedTotalTax,
    grandTotal: roundedGrandTotal,
    customerMargin,
    marginAmount,
    grandTotalWithMargin,
    extraExpenses: extraExpenses.map((exp) => ({
      expenseName: exp.expenseName,
      totalPrice: Math.ceil(exp.totalPrice * 100) / 100,
    })),
    extraExpenseAmount: roundedExtraExpenseAmount,
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

  const handleAddExtraExpense = () => {
    if (!expenseName.trim() || !expensePrice) {
      toast.error("Please enter expense name and price");
      return;
    }

    const newExpense = {
      id: Date.now(),
      expenseName: expenseName.trim(),
      totalPrice: parseFloat(expensePrice) || 0,
    };

    setExtraExpenses((prev) => [...prev, newExpense]);
    setExpenseName("");
    setExpensePrice("");
    setShowExtraExpensesModal(false);
    toast.success("Expense added!");
  };

  const handleRemoveExtraExpense = (id) => {
    setExtraExpenses(extraExpenses.filter((exp) => exp.id !== id));
    toast.info("Extra expense removed");
  };

  // Reset Form
  const resetForm = () => {
    // Header & Customer
    setWarehouse("");
    setCustomerId("");
    setSelectedCustomer(null);
    setCustomerSearch("");
    setCustomerMargin(0);

    // Billing Persons
    setSalesOwner("");
    setSalesOwnerId("");
    setSalesMan("");
    setDeliveryMan("");
    setBillingPerson("");

    // Items
    setItems([]);
    setProductGroup("");
    setProductGroupSearch("");
    setSelectedItem("");
    setItemSearch("");
    setQty("");
    setSellingPrice(0);
    setDiscountType("PERCENT");
    setDiscountPercent(0);
    setDiscountAmountInput(0);
    setGst(0);
    setCgst(0);
    setSgst(0);
    setIgst(false);
    setHsn("");

    // Sample Items
    setSampleItems([]);
    setSampleProductGroup("");
    setSampleSelectedItem("");
    setSampleItemSearch("");
    setSampleQty("");
    setSampleSellingPrice(0);

    // Expenses
    setExtraExpenses([]);
    setExpenseName("");
    setExpensePrice("");

    // E-Way
    setEnableEway(false);
    setEwayBillNo("");
    setEwayDate("");
    setVehicleNo("");
    setTransportMode("Road");
    setTransporterName("");
  };

  const handleFinalAction = async () => {
    if (!voucherType || !warehouse || items.length === 0) {
      return toast.error("Fill all required fields");
    }

    if (!customerId) {
      return toast.error("Please select a customer");
    }

    setIsSubmitting(true);

    try {
      // 📋 VALIDATE PAYLOAD
      if (!payload.branchId) {
        console.error("❌ Missing branchId in payload");
        return toast.error("Branch ID is missing. Please refresh and try again.");
      }

      console.log("📤 Sending payload:", {
        voucherType: payload.voucherType,
        branchId: payload.branchId,
        items: `${payload.items?.length} items`,
        customer: payload.customer?.name,
        grandTotal: payload.grandTotal,
      });

      const res = await fetch(`${API_BASE}/sales-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("❌ Server Error:", data);
        throw new Error(data.message || "Failed to create sales order");
      }

      console.log("✅ Sales Order Created:", data.invoiceId);
      toast.success(`Sales Order Created: ${data.invoiceId}`);
      setInvoiceId(data.invoiceId);
      resetForm();
    } catch (err) {
      console.error("❌ Error saving Sales Order:", err);
      toast.error(err.message || "Failed to save Sales Order");
    } finally {
      setIsSubmitting(false);
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

      {/* ROW 1: HEADER, CUSTOMER & PROCESSORS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* LEFT: VOUCHER, INVOICE, WAREHOUSE */}
        <div className="lg:col-span-3 bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-3 h-fit">
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

        {/* CENTER: CUSTOMER DETAILS */}
        <div className="lg:col-span-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-3 h-fit">
          <h3 className="text-[#319bab] font-black uppercase text-xs tracking-widest border-b pb-2 border-[#319bab]/30">
            Customer Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 relative" ref={customerDropdownRef}>
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
                className={`${inputClass} font-bold ${
                  selectedCustomer &&
                  ((selectedCustomer.debit || 0) - (selectedCustomer.credit || 0)) < 0
                    ? "text-red-500"
                    : "text-blue-600"
                }`}
                value={
                  selectedCustomer
                    ? `₹${((selectedCustomer.debit || 0) - (selectedCustomer.credit || 0)).toFixed(2)}`
                    : ""
                }
                readOnly
              />
            </div>

            <div className="lg:col-span-2">
              <label className={labelClass}>Address</label>
              <textarea
                className={`${inputClass} h-10`}
                value={selectedCustomer?.address || ""}
                readOnly
              />
            </div>

            {/* HIDDEN FIELDS TO RETAIN STATE LOGIC COMPATIBILITY */}
            <div className="hidden">
              <input className={inputClass} value={selectedCustomer?.whatsapp || ""} readOnly />
              <input className={`${inputClass} bg-gray-100`} value={salesOwner || ""} readOnly />
              <input className={inputClass} value={selectedCustomer?.email || ""} readOnly />
              <input className={inputClass} value={selectedCustomer?.district || ""} readOnly />
              <input className={inputClass} value={selectedCustomer?.state || ""} readOnly />
              <input className={inputClass} value={selectedCustomer?.pincode || ""} readOnly />
            </div>
          </div>
        </div>

        {/* RIGHT: ORDER PROCESSORS */}
        <div className="lg:col-span-3 bg-white p-4 rounded-xl shadow-sm border border-gray-100 h-fit space-y-3">
          <h3 className="text-[#319bab] font-black uppercase text-xs tracking-widest border-b pb-2 border-[#319bab]/30">
            Order Processors
          </h3>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className={labelClass}>Sales Man</label>
              <select className={selectClass} value={salesMan} onChange={(e) => setSalesMan(e.target.value)}>
                <option value="">-- Select Sales Man --</option>
                {salesMen.map((sm) => (<option key={sm._id} value={sm._id}>{sm.name} ({sm.phone})</option>))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Delivery Man</label>
              <select className={selectClass} value={deliveryMan} onChange={(e) => setDeliveryMan(e.target.value)}>
                <option value="">-- Select Delivery Man --</option>
                {deliveryMen.map((dm) => (<option key={dm._id} value={dm._id}>{dm.name} ({dm.phone})</option>))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Billing Person</label>
              <select className={selectClass} value={billingPerson} onChange={(e) => setBillingPerson(e.target.value)}>
                <option value="">-- Select --</option>
                {salesOwners.length > 0 && (<><option disabled>--- Sales Owners ---</option>{salesOwners.map((so) => (<option key={`so-${so._id}`} value={so._id}>{so.name} (Owner)</option>))}</>)}
                {salesMen.length > 0 && (<><option disabled>--- Sales Men ---</option>{salesMen.map((sm) => (<option key={`sm-${sm._id}`} value={sm._id}>{sm.name} (Sales Man)</option>))}</>)}
                {deliveryMen.length > 0 && (<><option disabled>--- Delivery Men ---</option>{deliveryMen.map((dm) => (<option key={`dm-${dm._id}`} value={dm._id}>{dm.name} (Delivery Man)</option>))}</>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ROW 2: ITEM ENTRY & ITEMS TABLE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-4">

        {/* LEFT: ADD ITEM */}
        <div className="lg:col-span-4 bg-primary/5 p-4 rounded-xl border border-primary/10 space-y-3 h-fit">
          <h3 className="text-[#319bab] font-black uppercase text-xs tracking-widest border-b pb-2 border-[#319bab]/30">
            Add Item
          </h3>

          {/* PRODUCT GROUP */}
          <div className="relative" ref={productGroupDropdownRef}>
            <label className={labelClass}>Product Group</label>
            <input
              type="text"
              placeholder="Type to search group..."
              value={productGroupSearch}
              onChange={(e) => {
                setProductGroupSearch(e.target.value);
                setShowProductGroupDropdown(true);
              }}
              onFocus={() => setShowProductGroupDropdown(true)}
              className={inputClass}
            />
            {showProductGroupDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto w-full md:w-80">
                {productGroups
                  .filter((g) =>
                    g.name.toLowerCase().includes(productGroupSearch.toLowerCase())
                  )
                  .map((g) => (
                    <div
                      key={g._id}
                      onClick={() => {
                        setProductGroup(g._id);
                        setProductGroupSearch(g.name);
                        setShowProductGroupDropdown(false);
                      }}
                      className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b text-sm"
                    >
                      {g.name}
                    </div>
                  ))}
                {productGroups.filter((g) =>
                  g.name.toLowerCase().includes(productGroupSearch.toLowerCase())
                ).length === 0 && (
                  <div className="px-3 py-2 text-gray-500 text-sm">
                    No group found
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="relative" ref={itemDropdownRef}>
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
                disabled={!warehouse}
                className={`${inputClass} ${(!warehouse) ? 'bg-gray-100 cursor-not-allowed' : ''}`}
              />

              {showItemDropdown && warehouse && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                  {productsWithStock
                    .filter(p => p.name.toLowerCase().includes(itemSearch.toLowerCase()))
                    .map((p) => {
                      const availableQty = availableQtyCache[p._id] ?? p.availableQty ?? 0;
                      const isOutOfStock = availableQty === 0;
                      return (
                        <div
                          key={p._id}
                          onClick={() => !isOutOfStock && handleItemSelection(p._id)}
                          className={`px-3 py-2 border-b text-sm ${isOutOfStock ? 'bg-gray-50 cursor-not-allowed opacity-60' : 'hover:bg-blue-50 cursor-pointer'}`}
                        >
                          <div className="font-semibold">{p.name} ({p.perQty || 1}:{p.units || ""})</div>
                          <div className={`text-xs ${isOutOfStock ? 'text-red-500 font-semibold' : 'text-gray-500'}`}>
                            Available: {availableQty} {isOutOfStock && '(Out of Stock)'}
                          </div>
                        </div>
                      );
                    })}
                  {productsWithStock.filter(p => p.name.toLowerCase().includes(itemSearch.toLowerCase())).length === 0 && (
                    <div className="px-3 py-2 text-gray-500 text-sm">No items found</div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>HSN</label>
                <input className={inputClass} value={hsn} readOnly />
              </div>
              <div>
                <label className={labelClass}>Selling ₹</label>
                <input type="number" className={inputClass} value={sellingPrice} onChange={(e) => setSellingPrice(+e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Quantity</label>
                <input
                  type="number"
                  className={inputClass}
                  value={qty}
                  min={0}
                  max={availableQtyCache[selectedItem] ?? productsWithStock.find(p => p._id === selectedItem)?.availableQty ?? 0}
                  onChange={(e) => setQty(e.target.value === "" ? "" : +e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <label className={labelClass}>GST %</label>
                <input type="number" className={inputClass} value={gst} onChange={(e) => setGst(+e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Discount Type</label>
                <select className={selectClass} value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
                  <option value="PERCENT">%</option>
                  <option value="AMOUNT">₹</option>
                </select>
              </div>
              {discountType === "PERCENT" ? (
                <div>
                  <label className={labelClass}>Discount %</label>
                  <input type="number" className={inputClass} value={discountPercent} min="0" max="100" onChange={(e) => setDiscountPercent(+e.target.value)} />
                </div>
              ) : (
                <div>
                  <label className={labelClass}>Discount ₹</label>
                  <input type="number" className={inputClass} value={discountAmountInput} min="0" onChange={(e) => setDiscountAmountInput(+e.target.value)} />
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 py-1">
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

            <div>
              <label className={labelClass}>Total ₹</label>
              <input className={`${inputClass} font-bold text-[#319bab] text-lg`} value={displayPrice.toFixed(2)} readOnly />
            </div>

            <button onClick={addItem} className="w-full bg-[#319bab] text-white h-[42px] rounded-xl font-bold flex items-center justify-center hover:bg-[#257f87] transition shadow-lg cursor-pointer active:scale-95">
              <FaPlus className="mr-2" /> ADD ITEM
            </button>
          </div>
        </div>

        {/* RIGHT: ITEMS TABLE */}
        <div className="lg:col-span-8 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-fit flex flex-col">
          <h3 className="text-[#319bab] font-black uppercase text-xs tracking-widest p-5 border-b border-gray-100 bg-gray-50/50">
            Added Items Phase
          </h3>
          {items.length > 0 ? (
            <div className="overflow-x-auto">
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
                      <td className="px-4 py-3 text-right text-red-500">₹{item.discountAmount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">
                        {item.igst ? `IGST ${item.gst}%` : `CGST ${item.cgst}% + SGST ${item.sgst}%`}
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
          ) : (
            <div className="p-8 text-center text-gray-400 text-sm font-semibold">
              No items added yet.
            </div>
          )}
        </div>

      </div>

      {/* ROW 3: SAMPLES, EXPENSES AND E-WAY/SUMMARY */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-4">

        {/* LEFT: SAMPLES AND EXPENSES */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-yellow-50 border-2 border-yellow-200 p-4 rounded-xl space-y-3 shadow-sm">
            <h3 className="text-yellow-700 font-black uppercase text-sm tracking-widest border-b border-yellow-200 pb-2">
              🎁 Sample Products (Not Billed)
            </h3>
            <p className="text-xs text-yellow-600">Sample products are tracked but do not affect the bill total</p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div className="relative md:col-span-2">
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
                  className={inputClass}
                />
                {showSampleItemDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                    {loadingSampleProducts && <div className="px-3 py-2 text-gray-500 text-sm text-center">🔍 Loading products...</div>}
                    {!loadingSampleProducts && filteredSampleProducts
                      .filter(p => p.name.toLowerCase().includes(sampleItemSearch.toLowerCase()))
                      .map((p) => {
                        const availableQty = p.totalQty || 0;
                        const isOutOfStock = availableQty === 0;
                        return (
                          <div
                            key={p._id}
                            onClick={() => !isOutOfStock && handleSampleItemSelection(p._id)}
                            className={`px-3 py-2 border-b text-sm ${isOutOfStock ? 'bg-gray-50 cursor-not-allowed opacity-60' : 'hover:bg-yellow-50 cursor-pointer'}`}
                          >
                            <div className="font-semibold">{p.name}</div>
                            <div className={`text-xs ${isOutOfStock ? 'text-red-500 font-semibold' : 'text-gray-500'}`}>
                              Available: {availableQty} {isOutOfStock && '(Out of Stock)'}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
              <div>
                <label className={labelClass}>Qty</label>
                <input type="number" className={inputClass} value={sampleQty} onChange={(e) => setSampleQty(e.target.value === "" ? "" : +e.target.value)} placeholder="0" />
              </div>
              <button onClick={addSampleItem} className="bg-yellow-500 text-white h-[42px] rounded-xl font-bold flex items-center justify-center hover:bg-yellow-600 transition shadow-lg active:scale-95">
                <FaPlus className="mr-2" /> ADD
              </button>
            </div>

            {sampleItems.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-yellow-200 overflow-hidden mt-4">
                <table className="w-full text-sm">
                  <thead className="bg-yellow-100 text-yellow-700 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="px-3 py-2 text-left">Item</th>
                      <th className="px-3 py-2 text-center">Qty</th>
                      <th className="px-3 py-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-t border-yellow-100">
                    {sampleItems.map((item, index) => (
                      <tr key={index} className="hover:bg-yellow-50">
                        <td className="px-3 py-2 font-semibold text-yellow-900">{item.name}</td>
                        <td className="px-3 py-2 text-center font-bold">{item.qty}</td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => removeSampleItem(index)} className="text-red-500 hover:text-red-700"><FaTrash /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 shadow-sm space-y-3">
            <div className="flex justify-between items-center text-sm">
              <div>
                <span className="text-orange-700 font-black tracking-widest uppercase border-b border-orange-200 pb-1 text-sm">💰 Extra </span>
                <div className="text-xs text-orange-600 mt-1">
                  {extraExpenses.length > 0 ? `${extraExpenses.length} expense(s) - ₹${roundedExtraExpenseAmount.toFixed(2)}` : "Miscellaneous charges"}
                </div>
              </div>
              <button onClick={() => setShowExtraExpensesModal(true)} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-bold transition">
                + Add Expense
              </button>
            </div>

            {extraExpenses.length > 0 && (
              <div className="space-y-2 mt-4">
                {extraExpenses.map((exp) => (
                  <div key={exp.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-orange-100">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{exp.expenseName}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-bold text-orange-600">₹{(exp.totalPrice || 0).toFixed(2)}</p>
                      <button onClick={() => handleRemoveExtraExpense(exp.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-full transition"><FaTrash /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: E-WAY BILL AND SUMMARY */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 h-fit space-y-3">
            <div className="flex items-center justify-between border-b pb-2 border-gray-100">
              <h3 className="text-[#319bab] font-black uppercase text-xs tracking-widest">
                E-Way Bill Details
              </h3>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={enableEway} onChange={(e) => setEnableEway(e.target.checked)} />
                <span className="text-xs font-bold text-gray-600">Enable E-Way</span>
              </div>
            </div>

            {enableEway ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>E-Way Bill No</label>
                  <input type="text" className={inputClass} value={ewayBillNo} onChange={(e) => setEwayBillNo(e.target.value)} placeholder="Enter E-Way No" />
                </div>
                <div>
                  <label className={labelClass}>E-Way Date</label>
                  <input type="date" className={inputClass} value={ewayDate} onChange={(e) => setEwayDate(e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Vehicle No</label>
                  <input type="text" className={inputClass} value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} placeholder="TN09AB1234" />
                </div>
                <div>
                  <label className={labelClass}>Transport Mode</label>
                  <select className={selectClass} value={transportMode} onChange={(e) => setTransportMode(e.target.value)}>
                    <option value="Road">Road</option>
                    <option value="Rail">Rail</option>
                    <option value="Air">Air</option>
                    <option value="Ship">Ship</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Transporter</label>
                  <input type="text" className={inputClass} value={transporterName} onChange={(e) => setTransporterName(e.target.value)} placeholder="ABC Logistics" />
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-gray-400 text-sm font-semibold">
                Enable E-Way Bill to add transport details
              </div>
            )}

            {/* ORDER SUMMARY */}
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-primary/5 h-fit">
              <h3 className="text-[#319bab] font-black uppercase text-sm tracking-widest mb-4 border-b pb-2 border-[#319bab]/30">
                Order Summary
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-bold">₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Discount</span>
                  <span className="font-bold text-red-500">-₹{totalDiscount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Tax Amount</span>
                  <span className="font-bold">₹{totalTax.toFixed(2)}</span>
                </div>
                {extraExpenses.length > 0 && (
                  <div className="flex justify-between text-sm bg-orange-50 px-3 py-2 rounded-lg">
                    <span className="text-orange-700 font-semibold">Extra Expenses</span>
                    <span className="font-bold text-orange-600">₹{roundedExtraExpenseAmount.toFixed(2)}</span>
                  </div>
                )}
                {sampleItems.length > 0 && (
                  <div className="pt-2 border-t border-yellow-200 mt-2">
                    <div className="flex justify-between text-xs text-yellow-700 font-semibold">
                      <span>📦 Sample Items: {sampleItems.reduce((s, i) => s + i.qty, 0)} units (Not in total)</span>
                    </div>
                  </div>
                )}
                <div className="pt-4 border-t border-gray-200 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-800 font-black text-sm uppercase">Grand Total</span>
                    <span className="text-4xl font-black text-[#319bab] italic">₹{roundedGrandTotal.toFixed(2)}</span>
                  </div>
                </div>
                <div className="mt-8">
                  <button 
                    onClick={handleFinalAction} 
                    disabled={isSubmitting}
                    className={`w-full text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm transition shadow-2xl hover:shadow-primary/50 cursor-pointer active:scale-95 ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#319bab] hover:bg-[#257f87]'}`}>
                    {isSubmitting ? 'Processing...' : 'Place Sales Order'}
                  </button>
                </div>
              </div>
            </div>
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
                  <label className={labelClass}>Amount (₹)</label>
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
}
