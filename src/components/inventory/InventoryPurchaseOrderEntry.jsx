import { useEffect, useState, useRef } from "react";
import { FaPlus, FaTrash } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";
import { useInventory } from "../../context/InventoryContext";
import InventoryAddProductGroupModal from "./InventoryAddProductGroupModal";
import InventoryAddProductModal from "./InventoryAddProductModal";
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
  onPOSaved = () => { }
}) => {
  const { warehouses } = useInventory();
  const { currentBranch, user } = useBranch();

  // Check if the user has this new feature explicitly disabled by Super Admin. (Defaults to true)
  const canUseQuickLinks = user?.role === "SUPER_ADMIN" || user?.actionPermissions?.create_shortcuts !== false;

  // Header State
  const [voucherType, setVoucherType] = useState("");
  const [vendor, setVendor] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [warehouse, setWarehouse] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [productGroup, setProductGroup] = useState("");
  const [billingPerson, setBillingPerson] = useState(user?.name || "");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

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
  useEffect(() => { if (user?.name) setBillingPerson(user.name); }, [user]);

  // FETCH MASTER EXTRA EXPENSE NAMES
  useEffect(() => {
    const branchId = currentBranch?._id || currentBranch?.id;
    if (!branchId) return;
    const fetchMasterNames = async () => {
      try {
        const res = await fetchWithAuth(`${API_BASE}/extra-expense-master/${branchId}`);
        const data = await res.json();
        if (data.success) {
          setMasterExpenseNames(data.data.map(item => item.name));
        }
      } catch (err) {
        console.error("Error fetching master expense names:", err);
      }
    };
    fetchMasterNames();
  }, [currentBranch]);

  // Item Entry State
  const [selectedItem, setSelectedItem] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [qty, setQty] = useState("");
  const [purchasePrice, setPurchasePrice] = useState(0);
  const [sellingPrice, setSellingPrice] = useState(0);
  const [discountPercent, setDiscountPercent] = useState("");
  const [discountType, setDiscountType] = useState("percent"); // "percent" or "amount"
  const [displayPrice, setDisplayPrice] = useState(0);
  const [hsn, setHsn] = useState("");
  const [gst, setGst] = useState(0);
  const [cgst, setCgst] = useState(0);
  const [sgst, setSgst] = useState(0);
  const [igst, setIgst] = useState(false);
  const [selectedProductData, setSelectedProductData] = useState(null);

  // UNIT CONVERSION STATES
  const [convValue, setConvValue] = useState("");
  const [convUnit, setConvUnit] = useState("");
  const [convAltValue, setConvAltValue] = useState("");
  const [convAltUnit, setConvAltUnit] = useState("");
  const [altQty, setAltQty] = useState(0);

  // Footer State
  const [extraExpenses, setExtraExpenses] = useState([]);
  const [showExtraExpensesModal, setShowExtraExpensesModal] = useState(false);
  const [isCustomExpense, setIsCustomExpense] = useState(false);
  const [expenseName, setExpenseName] = useState("Transport");
  const [expensePrice, setExpensePrice] = useState("");
  const [expenseGst, setExpenseGst] = useState("");
  const [masterExpenseNames, setMasterExpenseNames] = useState([]);

  // Custom discount and round off states
  const [customDiscount, setCustomDiscount] = useState("");
  const [customDiscountType, setCustomDiscountType] = useState("amount"); // "amount" or "percentage"
  const [enableRoundOff, setEnableRoundOff] = useState(true);

  // VENDOR SEARCH STATES
  const [vendorSearch, setVendorSearch] = useState("");
  const [fetchedVendors, setFetchedVendors] = useState([]);
  const [searchingVendors, setSearchingVendors] = useState(false);
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  const vendorDropdownRef = useRef(null);

  // Item search states
  const [fetchedProducts, setFetchedProducts] = useState(products || []);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const itemDropdownRef = useRef(null);
  
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [availableQtyCache, setAvailableQtyCache] = useState({});

  // 🛡️ Price Warning Modal State
  const [showPriceWarningModal, setShowPriceWarningModal] = useState(false);
  const [pendingItemData, setPendingItemData] = useState(null);

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
        const res = await fetchWithAuth(url);
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

  // Dynamic Row Price (Pre-discount)
  useEffect(() => {
    const rawPrice = (parseFloat(purchasePrice) || 0) * (parseFloat(qty) || 0);
    setDisplayPrice(Math.round(rawPrice * 100) / 100);
  }, [qty, purchasePrice]);

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
    const product = fetchedProducts.find((p) => p._id === productId);
    if (!product) {
      console.warn("⚠️ Product not found in fetched products:", productId);
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

    // Load Unit Conversion from Product Master
    if (product.unitConversion) {
      setConvValue(product.unitConversion.value || "");
      setConvUnit(product.unitConversion.unit || product.units || "");
      setConvAltValue(product.unitConversion.altValue || "");
      setConvAltUnit(product.unitConversion.altUnit || "");
    } else {
      setConvValue("");
      setConvUnit(product.units || "");
      setConvAltValue("");
      setConvAltUnit("");
    }

    if (!igst) {
      setCgst((product.gst || product.tax || 0) / 2);
      setSgst((product.gst || product.tax || 0) / 2);
    }
  };

  // 🔍 ASYNC VENDOR & CUSTOMER SEARCH
  useEffect(() => {
    const fetchVendorsAndCustomers = async () => {
      setSearchingVendors(true);
      try {
        const branchId = currentBranch?._id || currentBranch?.id;
        if (!branchId) return;

        // Fetch vendors (linked ones will be excluded by backend by default)
        const vendorUrl = `${API_BASE}/vendors?search=${encodeURIComponent(vendorSearch)}&branchId=${branchId}&limit=50`;
        // Fetch customers (only linked ones)
        const customerUrl = `${API_BASE}/customers?search=${encodeURIComponent(vendorSearch)}&branchId=${branchId}&limit=50&onlyLinked=true`;

        const [vendorRes, customerRes] = await Promise.all([
          fetchWithAuth(vendorUrl),
          fetchWithAuth(customerUrl)
        ]);

        const vendorData = await vendorRes.json();
        const customerData = await customerRes.json();

        const vendorList = vendorData.success ? (vendorData.data || []) : [];
        const customerList = customerData.success ? (customerData.data || []) : [];

        // Merge them, filtering to double-check that customer records are linked to a vendor profile
        const taggedCustomers = customerList
          .filter(c => c.linkedVendorId && c.linkedVendorId !== "")
          .map(c => ({
            ...c,
            isCustomerParty: true
          }));

        setFetchedVendors([...vendorList, ...taggedCustomers]);
      } catch (err) {
        console.error("❌ Vendor/Customer search failed:", err);
        setFetchedVendors([]);
      } finally {
        setSearchingVendors(false);
      }
    };

    const timer = setTimeout(fetchVendorsAndCustomers, 300);
    return () => clearTimeout(timer);
  }, [vendorSearch, currentBranch]);

  // 🔍 ASYNC PRODUCT SEARCH
  useEffect(() => {
    if (!itemSearch.trim()) {
      setFetchedProducts(productGroup ? filteredProducts : products || []);
      return;
    }

    const fetchProductsFromBackend = async () => {
      setSearchingProducts(true);
      try {
        const branchId = currentBranch?._id || currentBranch?.id;
        // Construct search URL with optional product group filter (limit reduced to 15 for max performance)
        let url = `${API_BASE}/products?search=${encodeURIComponent(itemSearch)}&branchId=${branchId}&limit=15`;
        if (productGroup) url += `&productGroup=${productGroup}`;
        
        const res = await fetchWithAuth(url);
        const data = await res.json();

        if (data.success || Array.isArray(data)) {
          const list = Array.isArray(data) ? data : (data.data || []);
          setFetchedProducts(list);
        } else {
          setFetchedProducts([]);
        }
      } catch (err) {
        console.error("❌ Product search failed:", err);
        setFetchedProducts([]);
      } finally {
        setSearchingProducts(false);
      }
    };

    const timer = setTimeout(fetchProductsFromBackend, 300);
    return () => clearTimeout(timer);
  }, [itemSearch, currentBranch, products, productGroup, filteredProducts]);

  // 🔄 SYNC LIVE STOCK LEVELS (Anchor-Aware & HIGH-PERFORMANCE PARALLEL FETCH)
  useEffect(() => {
    if (!fetchedProducts.length) return;

    const syncAvailableQty = async () => {
      const newCache = { ...availableQtyCache };
      let changed = false;

      // Filter products that actually need stock syncing (not in cache or matches current search)
      const productsToFetch = fetchedProducts.filter(p => 
        newCache[p._id] === undefined || (itemSearch && p.name.toLowerCase().includes(itemSearch.toLowerCase()))
      );

      if (productsToFetch.length === 0) return;

      try {
        // Fire all stock queries in parallel for instant sub-100ms loading
        const results = await Promise.all(
          productsToFetch.map(async (p) => {
            try {
              const res = await fetchWithAuth(`${API_BASE}/products/available/${p._id}`);
              const data = await res.json();
              if (data.success) {
                return { id: p._id, qty: data.data?.availableQty || 0 };
              }
            } catch (err) {
              console.error(`Failed to sync stock for ${p._id}:`, err);
            }
            return null;
          })
        );

        results.forEach(res => {
          if (res) {
            newCache[res.id] = res.qty;
            changed = true;
          }
        });

        if (changed) {
          setAvailableQtyCache(newCache);
        }
      } catch (err) {
        console.error("Parallel stock sync failed:", err);
      }
    };

    syncAvailableQty();
  }, [fetchedProducts, itemSearch]);

  // Click Outside logic for Dropdowns
  useEffect(() => {
    function handleClickOutside(event) {
      if (vendorDropdownRef.current && !vendorDropdownRef.current.contains(event.target)) {
        setShowVendorDropdown(false);
      }
      if (itemDropdownRef.current && !itemDropdownRef.current.contains(event.target)) {
        setShowItemDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Add Item
  const addItem = () => {
    if (!selectedItem || qty <= 0) {
      toast.error("Please select a valid item and quantity!");
      return;
    }

    const product = selectedProductData;
    if (!product || product._id !== selectedItem) {
      toast.error("Product not found! Please select again.");
      return;
    }

    // 🛡️ RED MODAL ALERT FOR NEGATIVE MARGIN
    if (Number(sellingPrice) < Number(purchasePrice)) {
      setPendingItemData({ product, purchasePrice: Number(purchasePrice), sellingPrice: Number(sellingPrice) });
      setShowPriceWarningModal(true);
      return;
    }

    proceedAddItem(product, Number(purchasePrice), Number(sellingPrice));
  };

  const proceedAddItem = (product, finalPurchasePrice, finalSellingPrice) => {
    const rowPrice = (parseFloat(finalPurchasePrice) || 0) * (parseFloat(qty) || 0);
    
    let rowDiscount = 0;
    let finalDiscountPercent = 0;
    const discountVal = parseFloat(discountPercent) || 0;
    if (discountType === "percent") {
      rowDiscount = (rowPrice * discountVal) / 100;
      finalDiscountPercent = discountVal;
    } else {
      rowDiscount = discountVal;
      finalDiscountPercent = rowPrice > 0 ? (rowDiscount / rowPrice) * 100 : 0;
    }

    const taxableAmount = rowPrice - rowDiscount;
    const taxRate = igst ? gst : cgst + sgst;
    const rowTax = (taxableAmount * taxRate) / 100;
    const total = taxableAmount + rowTax;

    setItems((prev) => [
      ...prev,
      {
        productId: product._id,
        name: product.name,
        productGroup: product.productGroup || product.groupId,
        qty: Number(qty),
        altQty: altQty,
        altUnit: convAltUnit,
        unit: convUnit || product.units || "",
        perQty: product.perQty || 1,
        units: product.units || "",
        totalQty: product.totalQty || 0,
        purchasePrice: finalPurchasePrice,
        sellingPrice: finalSellingPrice,
        discountPercent: finalDiscountPercent,
        discountAmount: rowDiscount,
        rowPrice: rowPrice,
        taxableAmount: taxableAmount,
        rowTax: rowTax,
        hsn,
        gst,
        cgst,
        sgst,
        igst: igst ? gst : 0,
        total: total.toFixed(2),
      },
    ]);

    toast.success(`${product.name} added!`);

    setSelectedItem("");
    setItemSearch("");
    setSelectedProductData(null);
    setProductGroup("");
    setQty("");
    setPurchasePrice(0);
    setSellingPrice(0);
    setDiscountPercent("");
    setDiscountType("percent");
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
  const subtotal = items.reduce((sum, item) => sum + (item.rowPrice || 0), 0);
  const calculatedDiscount = items.reduce((sum, item) => sum + (item.discountAmount || 0), 0);
  
  let totalDiscount = calculatedDiscount;
  if (customDiscount !== "") {
    const val = parseFloat(customDiscount) || 0;
    if (customDiscountType === "percentage") {
      totalDiscount = (subtotal * val) / 100;
    } else {
      totalDiscount = val;
    }
  }
  const baseTaxable = subtotal - totalDiscount;

  const discountRatio = subtotal > 0 ? (totalDiscount / subtotal) : 0;
  const isCustomDiscountApplied = customDiscount !== "";

  const cgstTotal = items.reduce((sum, item) => {
    const netTaxable = isCustomDiscountApplied ? (item.rowPrice || 0) * (1 - discountRatio) : (parseFloat(item.taxableAmount) || 0);
    return sum + (netTaxable * (parseFloat(item.cgst) || 0) / 100);
  }, 0);

  const sgstTotal = items.reduce((sum, item) => {
    const netTaxable = isCustomDiscountApplied ? (item.rowPrice || 0) * (1 - discountRatio) : (parseFloat(item.taxableAmount) || 0);
    return sum + (netTaxable * (parseFloat(item.sgst) || 0) / 100);
  }, 0);

  const igstTotal = items.reduce((sum, item) => {
    const netTaxable = isCustomDiscountApplied ? (item.rowPrice || 0) * (1 - discountRatio) : (parseFloat(item.taxableAmount) || 0);
    return sum + (netTaxable * (parseFloat(item.igst) || 0) / 100);
  }, 0);

  const totalTax = cgstTotal + sgstTotal + igstTotal;

  const extraExpenseAmount = extraExpenses.reduce(
    (acc, exp) => acc + (exp.totalPrice || 0),
    0
  );
  
  const exactGrandTotal = baseTaxable + totalTax;
  const grandTotal = enableRoundOff ? Math.round(exactGrandTotal) : exactGrandTotal;
  const roundOff = enableRoundOff ? (Math.round((grandTotal - exactGrandTotal) * 100) / 100) : 0;

  const handleAddExtraExpense = async () => {
    if (!expenseName.trim() || !expensePrice) {
      toast.error("Please enter expense name and price");
      return;
    }

    const baseAmount = parseFloat(expensePrice) || 0;
    const gstPct = parseFloat(expenseGst) || 0;
    const gstAmount = (baseAmount * gstPct) / 100;
    const finalPrice = baseAmount + gstAmount;

    const nameToSave = expenseName.trim();

    const newExpense = {
      id: Date.now(),
      expenseName: nameToSave,
      amount: baseAmount,       // Legacy
      basePrice: baseAmount,    // New
      gst: gstPct,              // Legacy
      gstPercent: gstPct,       // New
      gstAmount: gstAmount,     // New
      totalPrice: finalPrice,
    };

    // If it's a custom expense, save it to the master list
    if (isCustomExpense) {
      const branchId = currentBranch?._id || currentBranch?.id;
      try {
        await fetchWithAuth(`${API_BASE}/extra-expense-master`, {
          method: "POST",
          body: JSON.stringify({ branchId, name: nameToSave }),
        });
        // Update local master list if not already present
        setMasterExpenseNames(prev => prev.includes(nameToSave) ? prev : [...prev, nameToSave]);
      } catch (err) {
        console.error("Failed to save custom expense name to master:", err);
      }
    }

    setExtraExpenses((prev) => [...prev, newExpense]);
    setExpenseName("Transport");
    setExpensePrice("");
    setExpenseGst("");
    setShowExtraExpensesModal(false);
    setIsCustomExpense(false);
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
        const res = await fetchWithAuth(
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
    setSelectedCustomerId(null);
    setVendorSearch("");
    setWarehouse("");
    setProductGroup("");
    setBillingPerson("");
    setDate(new Date().toISOString().split("T")[0]);

    // Items
    setItems([]);
    setSelectedItem("");
    setItemSearch("");
    setQty("");
    setPurchasePrice(0);
    setSellingPrice(0);
    setDiscountPercent("");
    setDiscountType("percent");
    setDisplayPrice(0);
    setHsn("");
    setGst(0);
    setCgst(0);
    setSgst(0);
    setIgst(false);
    setSelectedProductData(null);

    // Footer
    setExtraExpenses([]);
    setCustomDiscount("");
    setCustomDiscountType("amount");
    setEnableRoundOff(true);
  };

  // Place Purchase Order
  const handleFinalAction = async () => {
    if (!voucherType) return toast.error("Select Voucher Type!");
    if (!vendor) return toast.error("Select Vendor!");
    if (!warehouse) return toast.error("Select Warehouse!");

    if (items.length === 0) return toast.error("Add at least one product!");

    setSaving(true);
    const orderData = {
      branchId: currentBranch?._id || currentBranch?.id,
      voucherType,
      vendor,
      customerId: selectedCustomerId || undefined,
      warehouse,
      items: items.map(item => ({
        ...item,
        total: enableRoundOff ? Math.round(Number(item.total) || 0) : Math.round(Number(item.total) * 100) / 100
      })),
      subtotal: enableRoundOff ? Math.round(subtotal) : Math.round(subtotal * 100) / 100,
      totalTax: enableRoundOff ? Math.round(totalTax) : Math.round(totalTax * 100) / 100,
      totalDiscount: enableRoundOff ? Math.round(totalDiscount) : Math.round(totalDiscount * 100) / 100,
      extraExpenses: extraExpenses.map((exp) => ({
        expenseName: exp.expenseName,
        amount: enableRoundOff ? Math.round(Number(exp.amount || exp.basePrice) || 0) : Math.round(Number(exp.amount || exp.basePrice) * 100) / 100,
        basePrice: enableRoundOff ? Math.round(Number(exp.basePrice || exp.amount) || 0) : Math.round(Number(exp.basePrice || exp.amount) * 100) / 100,
        gst: Math.round(Number(exp.gst || exp.gstPercent) || 0),
        gstPercent: Math.round(Number(exp.gstPercent || exp.gst) || 0),
        gstAmount: enableRoundOff ? Math.round(Number(exp.gstAmount) || 0) : Math.round(Number(exp.gstAmount) * 100) / 100,
        totalPrice: enableRoundOff ? Math.round(Number(exp.totalPrice) || 0) : Math.round(Number(exp.totalPrice) * 100) / 100,
      })),
      extraExpenseAmount: enableRoundOff ? Math.round(extraExpenseAmount) : Math.round(extraExpenseAmount * 100) / 100,
      grandTotal: enableRoundOff ? Math.round(grandTotal) : Math.round(grandTotal * 100) / 100,
      enableRoundOff,
      billingPerson,
      invoiceId,
      date,
      status: "PLACED",
    };

    try {
      const res = await fetchWithAuth(`${API_BASE}/purchase-orders`, {
        method: "POST",
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
    } finally {
      setSaving(false);
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


      {/* HEADER */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100
                grid grid-cols-1 md:grid-cols-5 gap-4">

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">Voucher Type</label>
            {canUseQuickLinks && user?.allowedQuickLinks?.includes("voucher_type") && (
              <button
                onClick={() => setShowVoucherModal(true)}
                className="text-[#319bab] hover:bg-[#319bab]/10 p-1 rounded transition"
                title="Create New Voucher Type"
              >
                <FaPlus size={12} />
              </button>
            )}
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
          <label className={labelClass}>Order Date</label>
          <input
            type="date"
            className={inputClass}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="relative" ref={vendorDropdownRef}>
          <div className="flex justify-between items-center mb-1">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">Vendor</label>
            {canUseQuickLinks && user?.allowedQuickLinks?.includes("vendor") && (
              <button
                onClick={() => setShowVendorModal(true)}
                className="text-[#319bab] hover:bg-[#319bab]/10 p-1 rounded transition"
                title="Create New Vendor"
              >
                <FaPlus size={12} />
              </button>
            )}
          </div>
          <input
            type="text"
            className={inputClass}
            placeholder="Type to search vendor/customer..."
            value={vendorSearch}
            onChange={(e) => {
              setVendorSearch(e.target.value);
              setSelectedCustomerId(null);
              setShowVendorDropdown(true);
            }}
            onFocus={() => setShowVendorDropdown(true)}
          />
          {showVendorDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto w-full md:w-80">
              {searchingVendors && (
                <div className="px-3 py-2 text-gray-500 text-sm text-center italic">🔍 Searching...</div>
              )}
              {!searchingVendors && fetchedVendors.map((v) => (
                <div
                  key={v._id}
                  onClick={() => {
                    setVendor(v.name);
                    setVendorSearch(v.name);
                    setSelectedCustomerId(v.isCustomerParty ? v._id : null);
                    setShowVendorDropdown(false);
                  }}
                  className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b text-sm"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-800">{v.name}</span>
                    {v.isCustomerParty && (
                      <span className="bg-blue-100 text-blue-700 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                        Customer
                      </span>
                    )}
                  </div>
                  {(v.phone || v.whatsapp) && <div className="text-xs text-gray-400">{v.phone || v.whatsapp}</div>}
                </div>
              ))}
              {!searchingVendors && fetchedVendors.length === 0 && (
                <div className="px-3 py-2 text-gray-500 text-sm italic">No vendors found</div>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">Warehouse</label>
            {canUseQuickLinks && user?.allowedQuickLinks?.includes("warehouse") && (
              <button
                onClick={() => setShowWarehouseModal(true)}
                className="text-[#319bab] hover:bg-[#319bab]/10 p-1 rounded transition"
                title="Create New Warehouse"
              >
                <FaPlus size={12} />
              </button>
            )}
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
          <input
            className={`${inputClass} bg-gray-50 border-gray-100 font-semibold cursor-not-allowed`}
            value={billingPerson}
            readOnly
            placeholder="Logging in person..."
          />
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
                {canUseQuickLinks && user?.allowedQuickLinks?.includes("product_group") && (
                  <button
                    onClick={() => setShowProductGroupModal(true)}
                    className="text-[#319bab] hover:bg-[#319bab]/10 p-1 rounded transition"
                    title="Create New Product Group"
                  >
                    <FaPlus size={12} />
                  </button>
                )}
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
              <div className="relative" ref={itemDropdownRef}>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">Item Name</label>
                  {canUseQuickLinks && user?.allowedQuickLinks?.includes("product") && (
                    <button
                      onClick={() => setShowProductModal(true)}
                      className="text-[#319bab] hover:bg-[#319bab]/10 p-1 rounded transition"
                      title="Create New Item"
                    >
                      <FaPlus size={12} />
                    </button>
                  )}
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
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto w-full divide-y divide-gray-100">
                    {searchingProducts && (
                      <div className="px-4 py-3 text-gray-400 text-xs text-center italic flex items-center justify-center gap-2">
                        <span className="animate-spin h-3.5 w-3.5 border-2 border-[#319bab] border-t-transparent rounded-full"></span>
                        Searching products...
                      </div>
                    )}
                    {!searchingProducts && fetchedProducts.map((p) => {
                      const currentStock = availableQtyCache[p._id] ?? p.availableQty ?? p.totalQty ?? 0;
                      const isLowStock = currentStock <= 0;
                      return (
                        <div
                          key={p._id}
                          onClick={() => handleItemSelection(p._id)}
                          className="px-4 py-2.5 hover:bg-gray-50 cursor-pointer text-xs transition flex flex-col gap-1"
                        >
                          <div className="font-bold text-gray-800 line-clamp-1">
                            {p.name} <span className="text-[10px] text-gray-400 font-normal">({p.perQty || 1}:{p.units || ""})</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] mt-0.5">
                            <span className={`px-2 py-0.5 rounded-full font-semibold ${isLowStock ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                              Stock: {currentStock} {p.units || ""}
                            </span>
                            <span className="font-extrabold text-[#319bab] text-xs">₹{p.purchasingPrice || p.rate || 0}</span>
                          </div>
                        </div>
                      );
                    })}
                    {!searchingProducts && fetchedProducts.length === 0 && (
                      <div className="px-4 py-3 text-gray-400 text-xs text-center italic">No products found</div>
                    )}
                  </div>
                )}
                {selectedProductData && (
                  <div className="text-[10px] text-gray-500 mt-1">
                    Live Balance: {availableQtyCache[selectedProductData._id] ?? selectedProductData.availableQty ?? selectedProductData.totalQty ?? 0} {selectedProductData.units || ""}
                  </div>
                )}
              </div>
            </div>

            {/* ROW 2: Prices, Qty, HSN */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className={labelClass}>Purchase ₹</label>
                  {selectedProductData && (
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] font-black text-gray-400">
                        Prev: ₹{selectedProductData.purchasingPrice || 0}
                      </span>
                      {selectedProductData.marginPercentage > 0 && (
                        <span className="text-[9px] font-black text-indigo-500">
                          Margin: {selectedProductData.marginPercentage}%
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    className={`${inputClass} ${
                      selectedProductData && purchasePrice > (selectedProductData.purchasingPrice || 0) 
                        ? "border-red-300 bg-red-50" 
                        : selectedProductData && purchasePrice < (selectedProductData.purchasingPrice || 0)
                        ? "border-green-300 bg-green-50"
                        : ""
                    }`}
                    value={purchasePrice}
                    onChange={(e) => {
                      const val = +e.target.value;
                      setPurchasePrice(val);
                      // ⚡ AUTO-RECALCULATE SELLING PRICE
                      if (selectedProductData && selectedProductData.marginPercentage > 0) {
                        const newSelling = Math.round((val + (val * selectedProductData.marginPercentage / 100)) * 100) / 100;
                        setSellingPrice(newSelling);
                      }
                    }}
                  />
                  {selectedProductData && purchasePrice !== (selectedProductData.purchasingPrice || 0) && (
                    <div className={`absolute -top-6 right-0 text-[10px] font-black uppercase px-2 py-0.5 rounded-md shadow-sm ${
                      purchasePrice > (selectedProductData.purchasingPrice || 0) ? "bg-red-500 text-white" : "bg-green-500 text-white"
                    }`}>
                      {purchasePrice > (selectedProductData.purchasingPrice || 0) ? "📈 Internal Rate Increased" : "📉 Rate Decreased"}
                    </div>
                  )}
                </div>
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
                <div className="flex justify-between items-center mb-1">
                  <label className={labelClass}>Discount {discountType === "percent" ? "%" : "₹"}</label>
                  <button
                    type="button"
                    onClick={() => {
                      setDiscountType(prev => prev === "percent" ? "amount" : "percent");
                      setDiscountPercent("");
                    }}
                    className="text-[#319bab] hover:underline text-[9px] font-black uppercase tracking-tight transition active:scale-95 animate-pulse"
                  >
                    Use {discountType === "percent" ? "₹" : "%"}
                  </button>
                </div>
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
                Extra
              </h3>
              <button
                onClick={() => setShowExtraExpensesModal(true)}
                className="bg-orange-100 text-orange-600 px-4 py-2 rounded-lg font-bold text-xs hover:bg-orange-200 transition flex items-center gap-2"
              >
                + Add Extra
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
                    <th className="px-4 py-3 text-right text-red-500">Discount</th>
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
                      <td className="px-4 py-3 text-center">
                        <div className="font-bold">{item.qty} {item.unit || "Pcs"}</div>
                        {item.altQty > 0 && (
                          <div className="text-[10px] text-[#319bab] font-semibold">({item.altQty} {item.altUnit})</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">₹{(item.purchasePrice || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-red-600 font-bold">
                        {item.discountPercent || 0}%
                        <div className="text-[10px]">(-₹{(item.discountAmount || 0).toFixed(2)})</div>
                      </td>
                      <td className="px-4 py-3 text-right font-black text-gray-800">
                        ₹{(parseFloat(item.taxableAmount) || 0).toLocaleString()}
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

          {/* ORDER SUMMARY FOOTER (Same as Sales Order) */}
          <div className="bg-[#319bab] text-white p-6 rounded-3xl shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform"></div>
            
            <h3 className="text-xl font-black mb-4 flex items-center gap-2">
              <span className="w-8 h-1 bg-white rounded-full"></span>
              ORDER SUMMARY
            </h3>

            <div className="space-y-3 relative z-10 font-sans">
              <div className="flex justify-between items-center text-white/80">
                <span className="text-sm font-medium uppercase tracking-wider">Sub Total</span>
                <span className="font-bold">₹{subtotal.toLocaleString()}</span>
              </div>

              <div className="flex justify-between items-center text-red-200">
                <span className="text-sm font-medium uppercase tracking-wider">Total Discount</span>
                <div className="flex items-center gap-2 font-sans bg-white/10 p-1.5 rounded-lg border border-white/20">
                  {/* Selector for ₹ or % */}
                  <div className="flex rounded bg-black/20 p-0.5 border border-white/10">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomDiscountType("amount");
                        if (customDiscount !== "") {
                          const val = parseFloat(customDiscount) || 0;
                          const converted = ((subtotal * val) / 100).toFixed(2);
                          setCustomDiscount(converted);
                        }
                      }}
                      className={`px-2 py-0.5 text-[10px] font-black rounded transition-all ${
                        customDiscountType === "amount"
                          ? "bg-white text-[#319bab] shadow-sm"
                          : "text-white hover:bg-white/10"
                      }`}
                    >
                      ₹
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomDiscountType("percentage");
                        if (customDiscount !== "" && subtotal > 0) {
                          const val = parseFloat(customDiscount) || 0;
                          const converted = ((val / subtotal) * 100).toFixed(2);
                          setCustomDiscount(converted);
                        }
                      }}
                      className={`px-2 py-0.5 text-[10px] font-black rounded transition-all ${
                        customDiscountType === "percentage"
                          ? "bg-white text-[#319bab] shadow-sm"
                          : "text-white hover:bg-white/10"
                      }`}
                    >
                      %
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="font-bold text-xs">{customDiscountType === "amount" ? "-₹" : "-%"}</span>
                    <input
                      type="number"
                      step="any"
                      value={customDiscount}
                      onChange={(e) => setCustomDiscount(e.target.value)}
                      placeholder={
                        customDiscountType === "amount"
                          ? calculatedDiscount.toFixed(2)
                          : ((calculatedDiscount / (subtotal || 1)) * 100).toFixed(2)
                      }
                      className="w-20 px-2 py-0.5 bg-white/20 text-white font-bold border border-white/30 rounded text-right text-xs focus:outline-none focus:ring-1 focus:ring-white placeholder-red-200/50"
                    />
                  </div>
                </div>
              </div>

              {customDiscount !== "" && (
                <div className="flex justify-end text-[10px] text-red-200/80 -mt-2 pr-2">
                  {customDiscountType === "percentage" ? (
                    <span>Equivalent to -₹{((subtotal * (parseFloat(customDiscount) || 0)) / 100).toFixed(2)}</span>
                  ) : (
                    subtotal > 0 && (
                      <span>Equivalent to -{(((parseFloat(customDiscount) || 0) / subtotal) * 100).toFixed(2)}%</span>
                    )
                  )}
                </div>
              )}

              <div className="flex justify-between items-center text-white/95 border-t border-white/20 pt-2 mt-1">
                <span className="text-sm font-semibold uppercase tracking-wider">Discounted Value</span>
                <span className="font-black text-lg">₹{baseTaxable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>

              <div className="h-px bg-white/20 my-2"></div>

              <div className="grid grid-cols-3 gap-2 text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1">
                <span>CGST</span>
                <span>SGST</span>
                <span>IGST</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm font-mono mb-2">
                <span>₹{cgstTotal.toFixed(2)}</span>
                <span>₹{sgstTotal.toFixed(2)}</span>
                <span>₹{igstTotal.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center text-orange-200">
                <span className="text-sm font-medium uppercase tracking-wider">Extra Expenses</span>
                <span className="font-bold">₹{extraExpenseAmount.toLocaleString()}</span>
              </div>

              {/* Round Off Checkbox and Value */}
              <div className="flex justify-between items-center text-white/80 border-t border-white/20 pt-3 mt-1">
                <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2 select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableRoundOff}
                    onChange={(e) => setEnableRoundOff(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-[#319bab] bg-white/20 border-white/30 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  Round Off Grand Total
                </span>
                {roundOff !== 0 && (
                  <span className="text-xs font-mono italic">₹{roundOff.toFixed(2)}</span>
                )}
              </div>

              <div className="pt-4 mt-4 border-t border-white/30 flex justify-between items-end">
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-white/60 leading-none mb-1">Grand Total</span>
                  <span className="text-4xl font-black tracking-tighter">
                    ₹{enableRoundOff ? grandTotal.toLocaleString() : Number(grandTotal.toFixed(2)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <button 
                  onClick={handleFinalAction}
                  disabled={saving}
                  className={`px-10 py-4 bg-white text-[#319bab] rounded-2xl font-black hover:bg-gray-100 transition shadow-lg active:scale-95 flex items-center gap-2 ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {saving ? 'SAVING...' : 'PLACE PURCHASE ORDER'}
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
          setShowProductModal(false);
        }}
      />

      {/* 🛡️ RED BACKGROUND PRICE WARNING MODAL */}
      {showPriceWarningModal && pendingItemData && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* Header with Red Gradient */}
            <div className="bg-gradient-to-r from-red-600 to-rose-500 px-6 py-8 text-center text-white">
              <div className="mb-4 flex justify-center">
                <div className="rounded-full bg-white/20 p-3 ring-8 ring-white/10">
                  <svg className="h-10 w-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight">Purchase Warning!</h2>
              <p className="mt-2 text-sm font-medium text-red-50">Negative Purchase Margin Detected</p>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="mb-6 space-y-3 rounded-xl bg-red-50 p-4 border border-red-100">
                <div className="flex justify-between text-sm uppercase tracking-wider font-bold">
                  <span className="text-gray-500">Product</span>
                  <span className="text-red-700">{pendingItemData.product.name}</span>
                </div>
                <div className="h-px bg-red-200/50" />
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-medium tracking-tight">Selling Price</span>
                  <span className="font-black text-gray-900 italic">₹{pendingItemData.sellingPrice}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-medium tracking-tight">New Purchase Cost</span>
                  <span className="font-black text-red-600 italic">₹{pendingItemData.purchasePrice}</span>
                </div>
                <div className="mt-4 rounded-lg bg-red-600 px-3 py-2 text-center text-xs font-black uppercase text-white shadow-lg">
                  Negative Margin: ₹{Math.abs(Number(pendingItemData.sellingPrice) - Number(pendingItemData.purchasePrice)).toFixed(2)}
                </div>
              </div>

              <p className="mb-6 text-center text-[11px] font-bold uppercase leading-relaxed text-gray-500">
                Are you sure you want to purchase this item? <br/>
                <span className="text-red-500 tracking-tighter">The cost is higher than your current selling price.</span>
              </p>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowPriceWarningModal(false);
                    setPendingItemData(null);
                  }}
                  className="flex-1 rounded-xl border-2 border-gray-200 py-3 text-xs font-black uppercase tracking-widest text-gray-500 transition-all hover:bg-gray-50 active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    proceedAddItem(pendingItemData.product, Number(pendingItemData.purchasePrice), Number(pendingItemData.sellingPrice));
                    setShowPriceWarningModal(false);
                    setPendingItemData(null);
                  }}
                  className="flex-1 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 py-3 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-red-200 transition-all hover:opacity-90 active:scale-95"
                >
                  Buy at Loss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Extra Expenses Modal */}
      {showExtraExpensesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Add Extra </h3>

            <div className="space-y-4">
              {/* Expense Name */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className={labelClass}>Expense Name</label>
                  <button 
                    onClick={() => {
                      setIsCustomExpense(!isCustomExpense);
                      setExpenseName("");
                    }}
                    className="text-[#319bab] hover:underline text-[10px] font-bold uppercase flex items-center gap-1 transition-all active:scale-95"
                  >
                    {isCustomExpense ? "← Back to List" : "+ Add"}
                  </button>
                </div>
                
                {isCustomExpense ? (
                  <input
                    type="text"
                    className={inputClass}
                    value={expenseName}
                    onChange={(e) => setExpenseName(e.target.value)}
                    placeholder="Enter Custom Expense (e.g. Offloading)"
                    autoFocus
                  />
                ) : (
                  <select
                    className={selectClass}
                    value={expenseName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setExpenseName(val);
                      if (val === "Transport") {
                        setExpenseGst(18);
                      }
                    }}
                  >
                    <option value="Transport">Transport</option>
                    <option value="Discount">Discount</option>
                    <option value="Offloading">Offloading</option>
                    <option value="Unloading">Unloading</option>
                    <option value="Freezer">Freezer</option>
                    {masterExpenseNames
                      .filter(name => !["Transport", "Discount", "Offloading", "Unloading", "Freezer"].includes(name))
                      .map((name, idx) => (
                        <option key={idx} value={name}>{name}</option>
                      ))
                    }
                  </select>
                )}
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
                  Add Extra
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
