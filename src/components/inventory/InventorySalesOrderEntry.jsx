import { useEffect, useMemo, useRef, useState } from "react";
import { FaPlus, FaTrash } from "react-icons/fa";
import { ToastContainer, toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";
import InventoryAddCustomerModal from "./InventoryAddCustomerModal";
import InventoryAddDeliveryManModal from "./InventoryAddDeliveryManModal";
import InventoryAddProductGroupModal from "./InventoryAddProductGroupModal";
import InventoryAddProductModal from "./InventoryAddProductModal";
import InventoryAddSalesManModal from "./InventoryAddSalesManModal";
import InventoryAddVoucherTypeModal from "./InventoryAddVoucherTypeModal";
import InventoryAddWarehouseModal from "./InventoryAddWarehouseModal";

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
  customerCategories = [],
  branchId = ""
}) {
  const { user } = useBranch();
  // Check if the user has this new feature explicitly disabled by Super Admin. (Defaults to true)
  const canUseQuickLinks = user?.role === "SUPER_ADMIN" || user?.actionPermissions?.create_shortcuts !== false;

  const [voucherType, setVoucherType] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [warehouse, setWarehouse] = useState("");


  const [productGroup, setProductGroup] = useState("");
  const [selectedItem, setSelectedItem] = useState("");
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [localVoucherTypes, setLocalVoucherTypes] = useState(voucherTypes || []);

  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [localWarehouses, setLocalWarehouses] = useState(warehouses || []);

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [localCustomers, setLocalCustomers] = useState(customers || []);

  const [showProductGroupModal, setShowProductGroupModal] = useState(false);
  const [localProductGroups, setLocalProductGroups] = useState(productGroups || []);

  const [showSalesManModal, setShowSalesManModal] = useState(false);
  const [localSalesMen, setLocalSalesMen] = useState(salesMen || []);

  const [showDeliveryManModal, setShowDeliveryManModal] = useState(false);
  const [localDeliveryMen, setLocalDeliveryMen] = useState(deliveryMen || []);

  const [showProductModal, setShowProductModal] = useState(false);
  const [localProducts, setLocalProducts] = useState(products || []);

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



  const [poItems, setPoItems] = useState([]);
  const [discountType, setDiscountType] = useState("PERCENT");
  const [discountPercent, setDiscountPercent] = useState("");
  const [discountAmountInput, setDiscountAmountInput] = useState("");
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
  const [commonDiscount, setCommonDiscount] = useState("");

  const [extraExpenses, setExtraExpenses] = useState([]);
  const [showExtraExpensesModal, setShowExtraExpensesModal] = useState(false);
  const [isCustomExpense, setIsCustomExpense] = useState(false);
  const [expenseName, setExpenseName] = useState("Transport");
  const [expensePrice, setExpensePrice] = useState("");
  const [expenseGstPercent, setExpenseGstPercent] = useState(18);
  const [masterExpenseNames, setMasterExpenseNames] = useState([]);

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
  const [isClaim, setIsClaim] = useState(false);
  const [isLocked, setIsLocked] = useState(false); // New state for Lock Price checkbox
  const [isPriceAuthorized, setIsPriceAuthorized] = useState(false);
  const [activePriceRequest, setActivePriceRequest] = useState(null);
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const pollingRef = useRef(null);

  // UNIT CONVERSION STATES
  const [convValue, setConvValue] = useState("");
  const [convUnit, setConvUnit] = useState("");
  const [convAltValue, setConvAltValue] = useState("");
  const [convAltUnit, setConvAltUnit] = useState("");
  const [altQty, setAltQty] = useState(0);

  const unitOptions = ["Pcs", "Box", "Pkt", "Kg", "Grm", "Mtr", "Bundle", "Set", "Case", "Roll", "Bag"];

  // Check if current user is Admin or Super Admin
  const isAdmin = useMemo(() => {
    return user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  }, [user]);

  // POLLING LOGIC FOR PRICE REQUESTS
  const startStatusPolling = (reqId, pId) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetchWithAuth(`${API_BASE}/price-requests/my-status/${pId}`);
        const data = await res.json();
        
        if (data.success && data.data) {
          const { status } = data.data;
          setActivePriceRequest(data.data);
          
          if (status === "APPROVED") {
            setIsPriceAuthorized(true);
            setActivePriceRequest(data.data); // Update with final status
            clearInterval(pollingRef.current);
            toast.success("Price change approved by admin!");
          } else if (status === "REJECTED") {
            clearInterval(pollingRef.current);
            toast.error("Price change request rejected by admin.");
            setActivePriceRequest(null);
            setIsPriceAuthorized(false);
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 2000); // Poll every 2 seconds for almost instant updates
  };

  const checkPriceStatusOnSelect = async (pId) => {
    if (!pId) return;
    try {
      const res = await fetchWithAuth(`${API_BASE}/price-requests/my-status/${pId}`);
      const data = await res.json();
      
      if (data.success && data.data) {
        const { status } = data.data;
        setActivePriceRequest(data.data);
        
        if (status === "APPROVED") {
          setIsPriceAuthorized(true);
        } else if (status === "PENDING") {
          setIsPriceAuthorized(false);
          startStatusPolling(data.data._id, pId);
        } else {
          setIsPriceAuthorized(false);
        }
      } else {
        setActivePriceRequest(null);
        setIsPriceAuthorized(false);
        if (pollingRef.current) clearInterval(pollingRef.current);
      }
    } catch (err) {
      console.error("Check status error:", err);
    }
  };

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const handlePriceUnlockRequest = async () => {
    if (!selectedItem) {
      toast.warning("Please select a product first.");
      return;
    }
    
    try {
      const res = await fetchWithAuth(`${API_BASE}/price-requests`, {
        method: "POST",
        body: JSON.stringify({
          productId: selectedItem,
          productName: itemSearch,
          originalPrice: sellingPrice
        })
      });
      const data = await res.json();
      
      if (data.success) {
        setActivePriceRequest(data.data);
        if (data.data.status === "APPROVED") {
          setIsPriceAuthorized(true);
          toast.success("Price field unlocked!");
        } else {
          startStatusPolling(data.data._id, selectedItem);
          toast.info("Unlock request sent to admin. Please wait...");
        }
      } else {

        toast.error(data.message || "Failed to send request.");
      }
    } catch (err) {
      toast.error("Request failed.");
    }
  };

  const isCreditLimitExceeded = false;

  // REFS FOR CLICK OUTSIDE
  const itemDropdownRef = useRef(null);
  const customerDropdownRef = useRef(null);
  const productGroupDropdownRef = useRef(null);
  const sampleItemDropdownRef = useRef(null);

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
      if (sampleItemDropdownRef.current && !sampleItemDropdownRef.current.contains(event.target)) {
        setShowSampleItemDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // AUTO-SET LOGGED IN USER AS BILLING PERSON
  useEffect(() => {
      if (user && !billingPerson) {
      setBillingPerson(user.fullName || user.username || "");
    }
  }, [user]);

  // FETCH MASTER EXTRA EXPENSE NAMES
  useEffect(() => {
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
  }, [branchId]);

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
        const res = await fetchWithAuth(
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

  // Keep local voucher types updated if props change
  useEffect(() => {
    setLocalVoucherTypes(voucherTypes || []);
  }, [voucherTypes]);

  useEffect(() => {
    setLocalWarehouses(warehouses || []);
  }, [warehouses]);

  useEffect(() => {
    setLocalCustomers(customers || []);
  }, [customers]);

  // 🔄 AUTO-CALCULATE ALTERNATE QUANTITY
  useEffect(() => {
    const q = Number(qty) || 0;
    const v = Number(convValue) || 1;
    const av = Number(convAltValue) || 1;

    if (q > 0 && v > 0) {
      const calculated = (q / v) * av;
      setAltQty(Math.round(calculated * 100) / 100);
    } else {
      setAltQty(0);
    }
  }, [qty, convValue, convAltValue]);

  useEffect(() => {
    setLocalProductGroups(productGroups || []);
  }, [productGroups]);

  useEffect(() => {
    setLocalSalesMen(salesMen || []);
  }, [salesMen]);

  useEffect(() => {
    setLocalDeliveryMen(deliveryMen || []);
  }, [deliveryMen]);

  useEffect(() => {
    setLocalProducts(products || []);
  }, [products]);

  // Load purchase order items for HSN fallback
  useEffect(() => {
    const loadPoItems = async () => {
      try {
        const res = await fetchWithAuth(`${API_BASE}/purchase-orders/items`);
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
        const res = await fetchWithAuth(
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
      const res = await fetchWithAuth(
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
      setFilteredProducts(localProducts); // Use all products if no group
      return;
    }

    const fetchProductsByGroup = async () => {
      setLoadingProducts(true);
      try {
        const res = await fetchWithAuth(`${API_BASE}/products/group/${productGroup}`);
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
  }, [productGroup, localProducts]);

  // Fetch products for SAMPLE PRODUCTS section when sampleProductGroup changes
  useEffect(() => {
    if (!sampleProductGroup) {
      setFilteredSampleProducts(localProducts); // Use all products if no group
      return;
    }

    const fetchSampleProductsByGroup = async () => {
      setLoadingSampleProducts(true);
      try {
        const res = await fetchWithAuth(`${API_BASE}/products/group/${sampleProductGroup}`);
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
  }, [sampleProductGroup, localProducts]);

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
          const res = await fetchWithAuth(`${API_BASE}/products/available/${product._id}`);
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
      // 1️⃣ Get HSN and Prices from product database first
      let hsn = p.hsnCode || "";
      let sPrice = p.sellingPrice || 0;
      let pPrice = p.purchasingPrice || 0;

      // 2️⃣ Find last purchase order info for fallbacks if needed
      if (!hsn || !sPrice || !pPrice) {
        const poItem = poItems.find(
          (item) => String(item.productId || item.productId?._id) === String(p._id)
        );
        if (poItem) {
          if (!hsn) hsn = poItem.hsn || "";
          if (!sPrice) sPrice = poItem.sellingPrice || 0;
          if (!pPrice) pPrice = poItem.purchasingPrice || poItem.unitPrice || poItem.rate || 0;
        }
      }

      return {
        ...p,
        // Use product database fields directly or fallbacks
        availableQty: p.totalQty || 0,
        sellingPrice: sPrice,
        purchasingPrice: pPrice,
        gst: p.gst || 0,
        hsn,
      };
    });
  }, [filteredProducts, poItems]);

  // UNIT CONVERSION CALCULATION
  useEffect(() => {
    const q = parseFloat(qty) || 0;
    const val = parseFloat(convValue) || 1;
    const aVal = parseFloat(convAltValue) || 1;
    if (q > 0) {
      setAltQty(parseFloat(((q * aVal) / val).toFixed(2)));
    } else {
      setAltQty(0);
    }
  }, [qty, convValue, convAltValue]);

  const saveProductConversion = async () => {
    if (!selectedItem) {
      toast.warning("Please select a product first");
      return;
    }
    try {
      const res = await fetchWithAuth(`${API_BASE}/products/${selectedItem}`, {
        method: "PUT",
        body: JSON.stringify({
          unitConversion: {
            value: convValue,
            unit: convUnit,
            altValue: convAltValue,
            altUnit: convAltUnit
          }
        })
      });
      if (res.ok) {
        toast.success("Product unit conversion saved!");
      }
    } catch (err) {
      toast.error("Failed to save conversion");
    }
  };



  const updateSellingPrice = (product, cMargin) => {
    if (!product) return 0;

    // 🛡️ NEW ADDITIVE LOGIC: Final Price = PurchasingPrice * (1 + (NormalMargin + AdminMargin/CustomerMargin) / 100)
    const purchasingPrice = Number(product.purchasingPrice || 0);
    const normalMargin = Number(product.marginPercentage || 0);

    // Determine relative margin: Admin Margin overrides Customer Margin (only if non-zero)
    let relativeMargin = Number(cMargin || 0);
    if (product.adminMargin !== undefined && product.adminMargin !== null && product.adminMargin !== "" && Number(product.adminMargin) !== 0) {
      relativeMargin = Number(product.adminMargin);
      console.log(`🛡️ Using Admin Margin: ${relativeMargin}% (Normal: ${normalMargin}%)`);
    } else {
      console.log(`🛡️ Using Customer Margin: ${relativeMargin}% (Normal: ${normalMargin}%)`);
    }

    const totalMargin = normalMargin + relativeMargin;
    let adjustedPrice = 0;

    if (purchasingPrice > 0) {
      adjustedPrice = purchasingPrice + (purchasingPrice * totalMargin / 100);
    } else {
      // Fallback if purchasing price is missing
      const baseSellingPrice = Number(product.sellingPrice || 0);
      adjustedPrice = baseSellingPrice + (baseSellingPrice * relativeMargin / 100);
    }

    const finalPrice = Math.round(adjustedPrice * 100) / 100;
    setSellingPrice(finalPrice);
    
    // 🛡️ ALERT ON ZERO PRICE
    if (finalPrice <= 0) {
      toast.warning(`Selling Price Alert: "${product.name}" has no selling price (₹0). Please enter it manually.`);
    }
    
    return finalPrice;
  };

  const handleItemSelection = (id) => {
    const product = productsWithStock.find(p => p._id === id);
    if (!product) return;

    setIsLocked(false);
    setSelectedItem(id);
    setItemSearch(product.name);
    setShowItemDropdown(false);
    setQty(1);

    // 🛡️ CHECK IF PRICE IS ALREADY AUTHORIZED OR PENDING (Persistent logic)
    if (!isAdmin) {
      checkPriceStatusOnSelect(id);
    }

    // Auto-select Product Group if not already selected or if different
    const pGroupId = product.productGroup?._id || product.productGroup || product.groupId?._id || product.groupId;
    if (pGroupId && pGroupId !== productGroup) {
      setProductGroup(pGroupId);
      const groupObj = productGroups.find((g) => g._id === pGroupId);
      if (groupObj) {
        setProductGroupSearch(groupObj.name);
      }
    }

    // 🛡️ Calculate and set price
    updateSellingPrice(product, customerMargin);

    setGst(product.gst);
    setGst(product.gst);

    setCgst(product.gst / 2);
    setSgst(product.gst / 2);
    setIgst(false);
    setHsn(product.hsn);

    // Set Unit Conversion from Product
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

    if (customerId) {
      fetchRecentOrders(customerId, id);
      // Fetch customer-specific locked price
      fetchCustomerLockedPrice(customerId, id);
    }
  };

  const fetchCustomerLockedPrice = async (cId, pId) => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/customer-locked-prices/${cId}/${pId}?branchId=${branchId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data.lockedPrice > 0) {
          setSellingPrice(data.data.lockedPrice);
          setIsLocked(true); // Auto-check if already locked
          console.log(`🔒 Applying Customer-Specific Locked Price: ${data.data.lockedPrice}`);
        }
      } else {
        setIsLocked(false);
      }
    } catch (err) {
      console.error("Failed to fetch customer locked price:", err);
      setIsLocked(false);
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

    // Fetch recent orders + locked price for selected customer + selected item
    if (selectedItem) {
      fetchRecentOrders(id, selectedItem);
      fetchCustomerLockedPrice(id, selectedItem);

      // Recalculate price based on new customer's margin
      const product = productsWithStock.find(p => p._id === selectedItem);
      if (product) {
        updateSellingPrice(product, customer?.margin || 0);
      }
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


  const addItem = async () => {
    if (isCreditLimitExceeded) {
      toast.error("Credit Limit Exceeded! Please request permission from admin to add items.");
      return;
    }
    if (!selectedItem) {
      toast.warning("Select item");
      return;
    }
    if (!qty || Number(qty) <= 0) {
      toast.warning("Quantity must be greater than 0");
      return;
    }

    // 🛡️ BLOCK ZERO PRICE ADDITION
    if (Number(sellingPrice) <= 0) {
      toast.error("Add Item Blocked: Selling price cannot be ₹0. Please set a price.");
      return;
    }

    const p = productsWithStock.find((x) => x._id === selectedItem);
    if (!p) {
      toast.error("Product not found. Please select again.");
      return;
    }

    // 1️⃣ USE SELLING PRICE AS IS (Already adjusted with margin during selection)
    const adjustedSellingPrice = Number(sellingPrice);

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

    // 7️⃣ Check if billed negatively
    const availableQty = availableQtyCache[p._id] ?? p.availableQty ?? 0;
    const isNegativeStockBilled = Number(qty) > availableQty;

    // 8️⃣ PUSH ITEM (using adjusted selling price with customer margin)
    setItems((prev) => [
      ...prev,
      {
        productId: p._id,
        name: p.name,
        hsn,
        qty: Number(qty),
        unit: convUnit, // 🛠️ FIX: Pass the base unit (e.g. Pkt)
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
        lockedPrice: isLocked ? Number(sellingPrice) : (p.lockedPrice || 0),
        isNegativeStockBilled,
        altQty: Number(altQty),
        altUnit: convAltUnit,
      },
    ]);

    // 8️⃣ SAVE LOCKED PRICE IF CHECKED
    if (isAdmin && isLocked) {
      try {
        await fetchWithAuth(`${API_BASE}/customer-locked-prices`, {
          method: "POST",
          body: JSON.stringify({
            branchId,
            customerId: customerId,
            productId: selectedItem,
            lockedPrice: Number(sellingPrice),
          }),
        });
      } catch (err) {
        console.error("Failed to save locked price:", err);
      }
    }

    // 9️⃣ RESET FORM
    setProductGroup("");
    setProductGroupSearch("");
    setSelectedItem("");
    setItemSearch("");
    setSellingPrice(0);
    setQty("");
    setDiscountPercent("");
    setDiscountAmountInput("");
    setGst(0);
    setIgst(false);
    setHsn("");
    setShowItemDropdown(false);
    setIsPriceAuthorized(false);
    setActivePriceRequest(null);
    if (pollingRef.current) clearInterval(pollingRef.current);
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

    const availableQty = p.totalQty || 0;
    const isNegativeStockBilled = Number(sampleQty) > availableQty;

    setSampleItems((prev) => [
      ...prev,
      {
        productId: p._id,
        name: p.name,
        hsn: p.hsnCode || "",
        qty: Number(sampleQty),
        sellingPrice: Number(sampleSellingPrice),
        isSample: true,
        isNegativeStockBilled,
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

  const taxBreakdown = useMemo(() => {
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let hasIgst = false;

    // 1. Tax from regular items
    items.forEach(i => {
      const base = i.qty * i.sellingPrice;
      const taxable = base - (i.discountAmount || 0);
      if (i.igst) {
        igst += (taxable * i.gst) / 100;
        hasIgst = true;
      } else {
        cgst += (taxable * (i.cgst || 0)) / 100;
        sgst += (taxable * (i.sgst || 0)) / 100;
      }
    });

    // 2. Tax from extra expenses (e.g. Transport)
    extraExpenses.forEach(exp => {
      if (hasIgst) {
        igst += exp.gstAmount || 0;
      } else {
        cgst += (exp.gstAmount || 0) / 2;
        sgst += (exp.gstAmount || 0) / 2;
      }
    });

    return { cgst, sgst, igst, hasIgst, total: cgst + sgst + igst };
  }, [items, extraExpenses]);

  const totalTax = taxBreakdown.total;

  // Calculate extra expenses BASE total (excluding GST from the display row if desired, but here we just need grand total)
  const extraExpenseAmount = extraExpenses.reduce(
    (sum, exp) => sum + exp.totalPrice,
    0
  );

  const grandTotal =
    subtotal - totalDiscount - (Number(commonDiscount) || 0) + totalTax + extraExpenses.reduce((sum, exp) => sum + exp.basePrice, 0);

  // Round up all item totals and financial values
  const roundedItems = items.map((item) => ({
    ...item,
    total: Math.ceil(item.total * 100) / 100,
  }));

  const roundedSubtotal = Math.ceil(subtotal * 100) / 100;
  const roundedTotalDiscount = Math.ceil(totalDiscount * 100) / 100;
  const roundedTotalTax = Math.ceil(totalTax * 100) / 100;
  const roundedExtraExpenseAmount = Math.ceil(extraExpenses.reduce((sum, exp) => sum + exp.basePrice, 0) * 100) / 100;

  // 📊 CALCULATE MARGIN AMOUNT (margin already applied to item prices)
  const marginAmount = customerMargin > 0
    ? Math.ceil((roundedSubtotal * customerMargin) / (100 + customerMargin) * 100) / 100
    : 0;

  const roundedGrandTotal = Math.round(subtotal - totalDiscount - (Number(commonDiscount) || 0) + totalTax + extraExpenses.reduce((sum, exp) => sum + exp.basePrice, 0));
  const grandTotalWithMargin = Math.round(roundedGrandTotal + marginAmount);

  const payload = {
    branchId,
    createdBy: user?.id || user?._id,
    createdByUsername: user?.username || user?.fullName || user?.name || "System",
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
    commonDiscount: Number(commonDiscount) || 0,
    totalTax: roundedTotalTax,
    grandTotal: roundedGrandTotal,
    customerMargin,
    marginAmount,
    grandTotalWithMargin,
    extraExpenses: extraExpenses.map((exp) => ({
      expenseName: exp.expenseName,
      basePrice: Math.ceil(exp.basePrice * 100) / 100,
      gstPercent: exp.gstPercent,
      gstAmount: Math.ceil(exp.gstAmount * 100) / 100,
      totalPrice: Math.ceil(exp.totalPrice * 100) / 100,
    })),
    extraExpenseAmount: roundedExtraExpenseAmount,
    salesOwner: salesOwnerId,
    salesMan,
    deliveryMan,
    billingPerson,
    isClaim,
    orderDate,
  };

  const handleAddExtraExpense = async () => {
    if (!expenseName.trim() || !expensePrice) {
      toast.error("Please enter expense name and price");
      return;
    }

    const baseAmount = parseFloat(expensePrice) || 0;
    const gstPercent = parseFloat(expenseGstPercent) || 0;
    const gstAmount = (baseAmount * gstPercent) / 100;
    const totalPrice = baseAmount + gstAmount;

    const nameToSave = expenseName.trim();

    const newExpense = {
      id: Date.now(),
      expenseName: nameToSave,
      basePrice: baseAmount,
      gstPercent,
      gstAmount,
      totalPrice: totalPrice,
    };

    // If it's a custom expense, save it to the master list
    if (isCustomExpense) {
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
    setExpenseGstPercent(18);
    setShowExtraExpensesModal(false);
    setIsCustomExpense(false);
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
    setOrderDate(new Date().toISOString().split("T")[0]);

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
    setDiscountPercent("");
    setDiscountAmountInput("");
    setCommonDiscount("");
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

    setIsClaim(false);
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

      const res = await fetchWithAuth(`${API_BASE}/sales-orders`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("❌ Server Error:", data);
        if (res.status === 403 && data.isCreditLimitExceeded) {
          toast.error(data.message, { autoClose: 5000 });
          setIsSubmitting(false);
          return;
        }
        throw new Error(data.message || "Failed to create sales order");
      }

      console.log("✅ Sales Order Created:", data.invoiceId);
      toast.success(`Sales Order Created: ${data.invoiceId}`);
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error("❌ Error saving Sales Order:", err);
      toast.error(err.message || "Failed to save Sales Order");
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestCreditLimitBypass = async () => {
    if (!customerId) return;
    try {
      const res = await fetchWithAuth(`${API_BASE}/customers/${customerId}/request-credit-bypass`, {
        method: "PATCH",
        body: JSON.stringify({
          requestedBy: user?.username || user?.name || "Unknown Staff"
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Credit limit bypass requested from admin");
        // Update local state to reflect pending status
        setSelectedCustomer(prev => ({
          ...prev,
          creditLimitRequestStatus: "PENDING"
        }));
      } else {
        toast.error(data.message || "Failed to request bypass");
      }
    } catch (err) {
      toast.error("Error requesting credit bypass");
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
            <div className="flex justify-between items-center mb-1">
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
            <select className={selectClass} value={voucherType} onChange={(e) => setVoucherType(e.target.value)}>
              <option value="">-- Select --</option>
              {localVoucherTypes.map((v) => (
                <option key={v._id} value={v.name}>{v.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Order Date</label>
            <input
              type="date"
              className={inputClass}
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass}>Sales Order ID</label>
            <input className={`${inputClass} bg-gray-50 font-bold text-[#319bab]`} value={invoiceId} readOnly />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
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
            <select className={selectClass} value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
              <option value="">-- Select --</option>
              {localWarehouses.map((w) => (
                <option key={w._id} value={w.name}>{w.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 mt-2 bg-yellow-50 p-2 rounded-lg border border-yellow-100">
            <input
              id="isClaim"
              type="checkbox"
              className="w-4 h-4 text-[#319bab] border-gray-300 rounded focus:ring-[#319bab]"
              checked={isClaim}
              onChange={(e) => setIsClaim(e.target.checked)}
            />
            <label htmlFor="isClaim" className="text-xs font-bold text-yellow-800 uppercase tracking-tight cursor-pointer">
              Mark as Claim
            </label>
          </div>
        </div>

        {/* CENTER: CUSTOMER DETAILS */}
        <div className="lg:col-span-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-3 h-fit">
          <h3 className="text-[#319bab] font-black uppercase text-xs tracking-widest border-b pb-2 border-[#319bab]/30">
            Customer Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 relative" ref={customerDropdownRef}>
              <div className="flex justify-between items-center mb-1">
                {canUseQuickLinks && user?.allowedQuickLinks?.includes("customer") && (
                  <button
                    onClick={() => setShowCustomerModal(true)}
                    className="text-[#319bab] hover:bg-[#319bab]/10 p-1 rounded transition"
                    title="Create New Customer"
                  >
                    <FaPlus size={12} />
                  </button>
                )}
              </div>
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
                className={`${inputClass} font-bold ${selectedCustomer &&
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
              {/* Credit Limit UI removed */}
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
              <div className="flex justify-between items-center mb-1">
                {canUseQuickLinks && user?.allowedQuickLinks?.includes("sales_man") && (
                  <button
                    onClick={() => setShowSalesManModal(true)}
                    className="text-[#319bab] hover:bg-[#319bab]/10 p-1 rounded transition"
                    title="Register New Sales Man"
                  >
                    <FaPlus size={12} />
                  </button>
                )}
              </div>
              <select className={selectClass} value={salesMan} onChange={(e) => setSalesMan(e.target.value)}>
                <option value="">-- Select Sales Man --</option>
                {localSalesMen.map((sm) => (<option key={sm._id} value={sm._id}>{sm.name} ({sm.phone})</option>))}
              </select>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                {canUseQuickLinks && user?.allowedQuickLinks?.includes("delivery_man") && (
                  <button
                    onClick={() => setShowDeliveryManModal(true)}
                    className="text-[#319bab] hover:bg-[#319bab]/10 p-1 rounded transition"
                    title="Register New Delivery Man"
                  >
                    <FaPlus size={12} />
                  </button>
                )}
              </div>
              <select className={selectClass} value={deliveryMan} onChange={(e) => setDeliveryMan(e.target.value)}>
                <option value="">-- Select Delivery Man --</option>
                {localDeliveryMen.map((dm) => (<option key={dm._id} value={dm._id}>{dm.name} ({dm.phone})</option>))}
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
        </div>
      </div>

      {/* ROW 2: ITEM ENTRY & ITEMS TABLE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-4">

        {/* LEFT: ADD ITEM */}
        <div className="lg:col-span-4 bg-primary/5 p-4 rounded-xl border border-primary/10 space-y-3 h-fit min-h-[400px] flex flex-col relative overflow-hidden">
          <h3 className="text-[#319bab] font-black uppercase text-xs tracking-widest border-b pb-2 border-[#319bab]/30">
            Add Item
          </h3>

          <>
            {/* PRODUCT GROUP */}
            <div className="relative" ref={productGroupDropdownRef}>
              <div className="flex justify-between items-center mb-1">
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

            <div className="grid grid-cols-1">
              {/* ITEM NAME */}
              <div className="relative" ref={itemDropdownRef}>
                <div className="flex justify-between items-center mb-1">
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
                  disabled={!warehouse}
                  className={`${inputClass} ${(!warehouse) ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                />

                {showItemDropdown && warehouse && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                    {productsWithStock
                      .filter(p => p.name.toLowerCase().includes(itemSearch.toLowerCase()))
                      .map((p) => {
                        const availableQty = availableQtyCache[p._id] ?? p.availableQty ?? 0;
                        return (
                          <div
                            key={p._id}
                            onClick={() => handleItemSelection(p._id)}
                            className={`px-3 py-2 border-b text-sm hover:bg-blue-50 cursor-pointer`}
                          >
                            <div className="font-semibold">{p.name} ({p.perQty || 1}:{p.units || ""})</div>
                            <div className={`text-xs ${availableQty <= 0 ? 'text-red-500 font-semibold' : 'text-gray-500'}`}>
                              Available: {availableQty} {availableQty <= 0 && '(Negative/Zero Stock Allowed)'}
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
                  <input 
                    className={`${inputClass} ${hsn && !/^\d{4}$|^\d{6}$|^\d{8}$/.test(String(hsn).trim()) ? 'border-red-500 bg-red-50' : ''}`} 
                    value={hsn} 
                    onChange={(e) => setHsn(e.target.value)}
                    placeholder="4, 6 or 8 digits"
                  />
                  {hsn && !/^\d{4}$|^\d{6}$|^\d{8}$/.test(String(hsn).trim()) && (
                    <p className="text-[10px] text-red-600 font-bold mt-1">⚠️ Must be 4, 6, or 8 digits</p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>
                    Selling ₹ {isAdmin ? (
                      <span className="ml-2 inline-flex items-center gap-1 cursor-pointer" onClick={() => setIsLocked(!isLocked)}>
                        <input
                          type="checkbox"
                          checked={isLocked}
                          onChange={(e) => setIsLocked(e.target.checked)}
                          className="w-3 h-3 text-[#319bab] border-gray-300 rounded focus:ring-[#319bab]"
                        />
                        <span className="text-[9px] text-[#319bab]">LOCK</span>
                      </span>
                    ) : (
                      <button 
                        onClick={handlePriceUnlockRequest}
                        disabled={isPriceAuthorized || activePriceRequest?.status === "PENDING"}
                        className={`ml-2 text-[9px] px-1 rounded font-bold uppercase transition ${
                          isPriceAuthorized 
                            ? "bg-green-100 text-green-700" 
                            : activePriceRequest?.status === "PENDING"
                              ? "bg-orange-100 text-orange-700 animate-pulse"
                              : "bg-[#319bab]/10 text-[#319bab] hover:bg-[#319bab]/20"
                        }`}
                      >
                        {isPriceAuthorized ? "Unlocked" : activePriceRequest?.status === "PENDING" ? "Request Sent..." : "Unlock"}
                      </button>
                    )}
                  </label>
                  <input
                    type="number"
                    className={`${inputClass} ${(isAdmin || isPriceAuthorized) ? "" : "bg-gray-100 cursor-not-allowed text-gray-500 font-bold"}`}
                    value={sellingPrice === 0 ? "" : sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value === "" ? "" : Number(e.target.value))}
                    readOnly={!isAdmin && !isPriceAuthorized}
                    placeholder="Price"
                  />
                  {activePriceRequest?.status === "PENDING" && (
                    <p className="text-[9px] text-orange-600 font-bold mt-1 italic animate-pulse">
                      Pending Admin approval...
                    </p>
                  )}
                </div>
              </div>

              {/* UNIT CONVERSION UI */}
              <div className="bg-[#319bab]/5 p-3 rounded-lg border border-[#319bab]/20 my-2 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-[#319bab] uppercase tracking-widest">Unit Conversion</span>
                  <button 
                    onClick={saveProductConversion}
                    className="text-[10px] bg-[#319bab] text-white px-2 py-0.5 rounded hover:bg-[#257f87] transition font-bold"
                  >
                    SAVE DEFAULT
                  </button>
                </div>
                <div className="flex gap-2 items-center">
                  <div className="w-16">
                    <input
                      type="text"
                      inputMode="decimal"
                      className={`${inputClass} text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                      value={convValue}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "" || /^\d*\.?\d*$/.test(val)) setConvValue(val);
                      }}
                      placeholder="Val"
                    />
                  </div>
                  <div className="flex-1">
                    <select 
                      className={`${selectClass} text-xs`}
                      value={unitOptions.find(u => u.toLowerCase() === (convUnit || "").toLowerCase()) || convUnit}
                      onChange={(e) => setConvUnit(e.target.value)}
                    >
                      <option value="">Unit</option>
                      {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                      {convUnit && !unitOptions.some(u => u.toLowerCase() === convUnit.toLowerCase()) && (
                        <option value={convUnit}>{convUnit}</option>
                      )}
                    </select>
                  </div>
                  <div className="text-center font-bold text-[#319bab]">=</div>
                  <div className="w-20">
                    <input
                      type="text"
                      inputMode="decimal"
                      className={`${inputClass} text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                      value={convAltValue}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "" || /^\d*\.?\d*$/.test(val)) setConvAltValue(val);
                      }}
                      placeholder="Alt"
                    />
                  </div>
                  <div className="flex-1">
                    <select 
                      className={`${selectClass} text-xs`}
                      value={unitOptions.find(u => u.toLowerCase() === (convAltUnit || "").toLowerCase()) || convAltUnit}
                      onChange={(e) => setConvAltUnit(e.target.value)}
                    >
                      <option value="">Alt Unit</option>
                      {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                      {convAltUnit && !unitOptions.some(u => u.toLowerCase() === convAltUnit.toLowerCase()) && (
                        <option value={convAltUnit}>{convAltUnit}</option>
                      )}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-center">
                    <label className={labelClass}>Quantity</label>
                    {altQty > 0 && (
                      <span className="text-[10px] font-bold text-[#319bab] bg-white px-1 rounded border border-[#319bab]/20">
                        {altQty} {convAltUnit}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      className={`${inputClass} pr-16`}
                      value={qty}
                      min={0}
                      max={availableQtyCache[selectedItem] ?? productsWithStock.find(p => p._id === selectedItem)?.availableQty ?? 0}
                      onChange={(e) => setQty(e.target.value === "" ? "" : +e.target.value)}
                      placeholder="0"
                    />
                    <span className="absolute right-3 top-2 text-[10px] text-gray-400 font-bold uppercase">{convUnit || "Pcs"}</span>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>GST %</label>
                  <input type="number" className={inputClass} value={gst} onChange={(e) => setGst(+e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1">
                <div>
                  <label className={labelClass}>Discount %</label>
                  <input
                    type="number"
                    className={inputClass}
                    value={discountPercent}
                    min="0"
                    max="100"
                    onChange={(e) => setDiscountPercent(e.target.value === "" ? "" : +e.target.value)}
                    placeholder="Enter percentage..."
                  />
                </div>
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
          </>
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
                      <td className="px-4 py-3 text-center">
                        <div className="font-bold">{item.qty} {item.unit || "Pcs"}</div>
                        {item.altQty > 0 && (
                          <div className="text-[10px] text-[#319bab] font-semibold">({item.altQty} {item.altUnit})</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">₹{item.sellingPrice}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-semibold text-gray-800">{item.discountPercent}%</div>
                        <div className="text-[10px] text-red-500">-₹{item.discountAmount.toFixed(2)}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {item.igst ? `IGST ${item.gst}%` : `CGST ${item.cgst}% + SGST ${item.sgst}%`}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-bold text-[#319bab]">₹{item.total.toFixed(2)}</div>
                        {item.lockedPrice > 0 && (
                          <div className="text-[10px] text-orange-600 font-bold bg-orange-50 px-1 rounded inline-block mt-0.5" title="Customer Locked Price">
                            Locked: ₹{item.lockedPrice}
                          </div>
                        )}
                      </td>
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
              <div className="relative md:col-span-2" ref={sampleItemDropdownRef}>
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
                        return (
                          <div
                            key={p._id}
                            onClick={() => handleSampleItemSelection(p._id)}
                            className={`px-3 py-2 border-b text-sm hover:bg-yellow-50 cursor-pointer`}
                          >
                            <div className="font-semibold">{p.name}</div>
                            <div className={`text-xs ${availableQty <= 0 ? 'text-red-500 font-semibold' : 'text-gray-500'}`}>
                              Available: {availableQty} {availableQty <= 0 && '(Negative/Zero Stock Allowed)'}
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
                  <div key={exp.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-orange-100 shadow-sm">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-800 text-sm tracking-tight">{exp.expenseName}</span>
                      <span className="text-[10px] text-gray-500 font-medium">
                        ₹{exp.basePrice.toFixed(2)} + {exp.gstPercent}% GST (₹{exp.gstAmount.toFixed(2)})
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-black text-orange-600 text-sm">₹{(exp.totalPrice || 0).toFixed(2)}</p>
                      <button onClick={() => handleRemoveExtraExpense(exp.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-full transition-all duration-200"><FaTrash size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-6 space-y-4">
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
              {/* <div className="flex justify-between text-sm">
                <span className="text-gray-500">Discount (Items)</span>
                <span className="font-bold text-red-500">-₹{totalDiscount.toFixed(2)}</span>
              </div> */}
              <div className="flex justify-between items-center text-sm border-b pb-2">
                <span className="text-gray-700 font-semibold tracking-wide">Common Discount</span>
                <div className="flex items-center gap-1">
                  <span className="text-gray-400 font-bold">₹</span>
                  <input
                    type="number"
                    min="0"
                    className="w-24 border border-gray-300 rounded px-2 py-1 text-right focus:ring-1 focus:ring-primary outline-none font-bold text-red-600 bg-red-50/30"
                    value={commonDiscount}
                    onChange={(e) => setCommonDiscount(e.target.value === "" ? "" : +e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
              {taxBreakdown.hasIgst ? (
                <div className="flex justify-between text-sm pt-2">
                  <span className="text-gray-500">IGST</span>
                  <span className="font-bold">₹{taxBreakdown.igst.toFixed(2)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-sm pt-2">
                    <span className="text-gray-500">CGST</span>
                    <span className="font-bold">₹{taxBreakdown.cgst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-1">
                    <span className="text-gray-500">SGST</span>
                    <span className="font-bold">₹{taxBreakdown.sgst.toFixed(2)}</span>
                  </div>
                </>
              )}
              {extraExpenses.length > 0 && (
                <div className="flex justify-between text-sm bg-orange-50 px-3 py-2 rounded-lg">
                  <span className="text-orange-700 font-semibold">Extra Expenses / Transport</span>
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

      {showExtraExpensesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Add Extra Expense</h3>

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
                    className="text-orange-600 hover:orange-700 hover:underline text-[10px] font-bold uppercase flex items-center gap-1 transition-all active:scale-95"
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
                        setExpenseGstPercent(18);
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

              <div className="grid grid-cols-2 gap-4">
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

                {/* GST % */}
                <div>
                  <label className={labelClass}>GST (%)</label>
                  <input
                    type="number"
                    className={inputClass}
                    value={expenseGstPercent}
                    onChange={(e) => setExpenseGstPercent(e.target.value)}
                    placeholder="18"
                    min="0"
                  />
                </div>
              </div>

              {/* Total Preview */}
              {expensePrice > 0 && (
                <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 flex justify-between items-center text-xs">
                  <span className="text-orange-700 font-semibold">Total with GST:</span>
                  <span className="text-orange-800 font-black">
                    ₹{(parseFloat(expensePrice) + (parseFloat(expensePrice) * parseFloat(expenseGstPercent) / 100)).toFixed(2)}
                  </span>
                </div>
              )}

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

      <InventoryAddVoucherTypeModal
        isOpen={showVoucherModal}
        onClose={() => setShowVoucherModal(false)}
        branchId={branchId}
        onSave={(newType) => {
          const addedType = newType.voucher || newType; // Backend returns varying structures sometimes
          setLocalVoucherTypes(prev => [...prev, addedType]);
          setVoucherType(addedType.name);
          setShowVoucherModal(false);
        }}
      />

      <InventoryAddWarehouseModal
        isOpen={showWarehouseModal}
        onClose={() => setShowWarehouseModal(false)}
        branchId={branchId}
        onSave={(newWarehouse) => {
          setLocalWarehouses(prev => [...prev, newWarehouse]);
          setWarehouse(newWarehouse.name);
          setShowWarehouseModal(false);
        }}
      />

      <InventoryAddCustomerModal
        isOpen={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        branchId={branchId}
        salesOwners={salesOwners}
        customerCategories={customerCategories}
        customerGroups={customerGroups}
        onSave={(newCustomer) => {
          // Because the frontend expects the customer object to be in `customers` or `fetchedCustomers` for proper display
          setLocalCustomers(prev => [...prev, newCustomer]);
          setFetchedCustomers(prev => [...prev, newCustomer]);
          setCustomerSearch(newCustomer.name);
          handleCustomerSelect(newCustomer._id, [newCustomer]);
          setShowCustomerModal(false);
        }}
      />

      <InventoryAddProductGroupModal
        isOpen={showProductGroupModal}
        onClose={() => setShowProductGroupModal(false)}
        branchId={branchId}
        onSave={(newGroup) => {
          setLocalProductGroups(prev => [...prev, newGroup]);
          setProductGroup(newGroup._id);
          setProductGroupSearch(newGroup.name);
          setShowProductGroupModal(false);
          setShowProductGroupDropdown(false);
        }}
      />

      <InventoryAddSalesManModal
        isOpen={showSalesManModal}
        onClose={() => setShowSalesManModal(false)}
        branchId={branchId}
        onSave={(newSalesMan) => {
          setLocalSalesMen(prev => [...prev, newSalesMan.data || newSalesMan]);
          setSalesMan((newSalesMan.data || newSalesMan)._id);
          setShowSalesManModal(false);
        }}
      />

      <InventoryAddDeliveryManModal
        isOpen={showDeliveryManModal}
        onClose={() => setShowDeliveryManModal(false)}
        branchId={branchId}
        onSave={(newDeliveryMan) => {
          setLocalDeliveryMen(prev => [...prev, newDeliveryMan.data || newDeliveryMan]);
          setDeliveryMan((newDeliveryMan.data || newDeliveryMan)._id);
          setShowDeliveryManModal(false);
        }}
      />

      <InventoryAddProductModal
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
        branchId={branchId}
        productGroups={localProductGroups}
        warehouses={localWarehouses}
        onSave={(newProduct) => {
          setLocalProducts(prev => [...prev, newProduct.data || newProduct]);
          setFilteredProducts(prev => [...prev, newProduct.data || newProduct]);
          setSelectedItem((newProduct.data || newProduct)._id);
          setItemSearch((newProduct.data || newProduct).name);
          handleProductSelect(newProduct.data || newProduct);
          setShowProductModal(false);
        }}
      />
    </div>
  );
}
