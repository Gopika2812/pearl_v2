import { useEffect, useState, Fragment } from "react";
import { FaArrowUp, FaBox, FaChevronDown, FaChevronUp, FaEdit, FaExclamationCircle, FaExclamationTriangle, FaList, FaSync, FaThLarge, FaFileExport } from "react-icons/fa";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import { API_BASE } from "../../api";
import { useBranch } from "../../context/BranchContext";

export default function BranchRecycling() {
  const { currentBranch, user } = useBranch();
  const fieldPermissions = user?.fieldPermissions || {};
  
  // Helper to extract/resolve restocking fields based on auto vs manual rules
  const getReorderParams = (product) => {
    if (!product) {
      return {
        reorderQty: 20,
        reorderLevel: 10,
        isAuto: true,
        conditionDays: 7,
        sellingQty: 0,
        hasManual: false,
        reorderMode: "HIGH",
        reorderQtyMode: "HIGH",
        thresholdMode: "HIGH"
      };
    }

    const config = (restockingConfigMode && restockingEditingProduct?._id === product._id)
      ? {
          reorderMode: restockingFormValues.reorderMode || "HIGH",
          reorderQtyMode: restockingFormValues.reorderQtyMode || restockingFormValues.reorderMode || "HIGH",
          thresholdMode: restockingFormValues.thresholdMode || restockingFormValues.reorderMode || "HIGH",
          salesPeriodDays: restockingFormValues.salesPeriodDays,
          sellingQtyInPeriod: restockingFormValues.sellingQtyInPeriod,
          threshold: restockingFormValues.threshold,
          restockingQty: restockingFormValues.restockingQty,
        }
      : product.restockingConfig;

    const reorderMode = config?.reorderMode || "HIGH";
    const reorderQtyMode = config?.reorderQtyMode || reorderMode;
    const thresholdMode = config?.thresholdMode || reorderMode;
    
    // Auto values
    const autoQty = (config?.sellingQtyInPeriod !== undefined && config?.sellingQtyInPeriod !== null)
      ? config.sellingQtyInPeriod
      : (product.reorderQty || 20);
    const autoThreshold = config?.sellingQtyInPeriod || product.reorderLevel || 10;
    
    // Manual values
    const manualQty = config?.restockingQty !== undefined && config?.restockingQty !== null
      ? config.restockingQty
      : (product.reorderQty || 20);
    const manualThreshold = config?.threshold !== undefined && config?.threshold !== null
      ? config.threshold
      : (product.reorderLevel || 10);

    let resolvedQty, resolvedThreshold;
    if (reorderQtyMode === "LOW") {
      resolvedQty = Math.min(autoQty, manualQty);
    } else {
      resolvedQty = Math.max(autoQty, manualQty);
    }

    if (thresholdMode === "LOW") {
      resolvedThreshold = Math.min(autoThreshold, manualThreshold);
    } else {
      resolvedThreshold = Math.max(autoThreshold, manualThreshold);
    }

    const hasManual = product.restockingConfig?.restockingQty !== undefined && product.restockingConfig?.restockingQty !== null;
    const isAuto = reorderQtyMode === "HIGH";
    const conditionDays = product.restockingConfig?.salesPeriodDays || 7;
    const sellingQty = product.restockingConfig?.sellingQtyInPeriod || 0;
    
    return {
      reorderQty: resolvedQty,
      reorderLevel: resolvedThreshold,
      isAuto,
      conditionDays,
      sellingQty,
      hasManual,
      reorderMode,
      reorderQtyMode,
      thresholdMode,
      autoQty,
      autoThreshold,
      manualQty,
      manualThreshold
    };
  };

  // Permission helper
  const isFieldAllowed = (fieldId) => {
    if (!user) return false;
    // Global Super Admin or Branch Admin (local) bypass checks
    if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") return true;
    
    const key = `restocking_${fieldId}`;
    return user.fieldPermissions?.[key] !== false; // Default to true if not explicitly restricted
  };

  const actionPermissions = user?.actionPermissions || {};
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restockingInProgress, setRestockingInProgress] = useState({});
  const [branchLoaded, setBranchLoaded] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [savingConfig, setSavingConfig] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [bulkRestockingInProgress, setBulkRestockingInProgress] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [pagination, setPagination] = useState({ total: 0, pages: 0, limit: 50 });
  const [viewMode, setViewMode] = useState("table"); // \"table\" or \"card\"
  const [selectedProductGroup, setSelectedProductGroup] = useState("All"); // Filter by group
  const [allProducts, setAllProducts] = useState([]); // Store all products for group filtering
  const [allProductGroups, setAllProductGroups] = useState([]); // Store all unique product groups
  const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" }); // Default: Alphabetical order

  // Full Page Stock Alert states
  const [showFullPageAlert, setShowFullPageAlert] = useState(false);
  const [alertProducts, setAlertProducts] = useState([]);
  const [alertDismissed, setAlertDismissed] = useState(false);

  // Restocking Configuration Modal State
  const [restockingConfigMode, setRestockingConfigMode] = useState(false);
  const [restockingEditingProduct, setRestockingEditingProduct] = useState(null);
  const [restockingFormValues, setRestockingFormValues] = useState({
    reorderMode: "HIGH",
    reorderQtyMode: "HIGH",
    thresholdMode: "HIGH",
    salesPeriodDays: 7,
    sellingQtyInPeriod: 0,
    threshold: null,
    restockingQty: null,
  });
  const [calculatingSellingQty, setCalculatingSellingQty] = useState(false);
  const [savingRestockingConfig, setSavingRestockingConfig] = useState(false);
  const [savingBulkConfig, setSavingBulkConfig] = useState(false);

  // Bulk Restock Preview Modal State
  const [bulkRestockPreviewMode, setBulkRestockPreviewMode] = useState(false);
  const [bulkRestockPreviewItems, setBulkRestockPreviewItems] = useState([]);
  const [bulkRestockEditQty, setBulkRestockEditQty] = useState({});

  // Fetch product groups directly from `/api/product-groups` immediately
  const fetchProductGroupsDirectly = async () => {
    if (!currentBranch?._id) return;

    try {
      const branchId = currentBranch._id;
      const url = `${API_BASE}/product-groups?branchId=${branchId}`;
      console.log("🔄 Fetching product groups directly from:", url);

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`API Error: ${res.status}`);
      }

      const data = await res.json();
      console.log("📦 Direct product groups response:", data);

      if (Array.isArray(data)) {
        const groupNames = data.map((g) => g.name).filter(Boolean);
        const finalGroups = ["All", ...Array.from(new Set(groupNames)).sort()];
        console.log("🏷️ Instantly loaded product groups:", finalGroups);
        setAllProductGroups(finalGroups);
      }
    } catch (err) {
      console.error("❌ Error fetching product groups directly:", err);
    }
  };

  // Fetch all products in one fast optimized single call to get all product groups available
  const fetchAllProductsForGroups = async () => {
    if (!currentBranch?._id) return;

    try {
      const branchId = currentBranch._id;
      console.log("🔄 Starting to fetch all products for group caching...");

      const url = `${API_BASE}/products?branchId=${branchId}&limit=10000&includeRestocking=true`;
      console.log(`📄 Fetching all products in single optimized call: ${url}`);

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`API Error: ${res.status}`);
      }

      const data = await res.json();
      let productList = [];

      if (data?.data && Array.isArray(data.data)) {
        productList = data.data;
      } else if (Array.isArray(data)) {
        productList = data;
      } else if (data?.products && Array.isArray(data.products)) {
        productList = data.products;
      }

      console.log(`✅ FINAL: Fetched ${productList.length} total products`);
      
      // Deduplicate by product ID to prevent React key collisions and unstable render states
      const uniqueMap = new Map();
      productList.forEach(p => {
        if (p && p._id) {
          uniqueMap.set(p._id, p);
        }
      });
      const uniqueProductsList = Array.from(uniqueMap.values());
      console.log(`✨ DEDUPLICATED: Reduced from ${productList.length} to ${uniqueProductsList.length} unique products`);

      // Store all products
      setAllProducts(uniqueProductsList);

      // Extract unique product groups from products as well, merging with any existing groups
      const groupsFromProducts = new Set(
        uniqueProductsList
          .map((p) => {
            if (p.productGroup && typeof p.productGroup === 'object') {
              return p.productGroup.name || p.productGroup._id;
            }
            return p.productGroup;
          })
          .filter(Boolean)
      );

      // Merge with what we already have or update groups
      setAllProductGroups((prev) => {
        const merged = new Set([...prev, ...groupsFromProducts]);
        return ["All", ...Array.from(merged).filter(g => g !== "All").sort()];
      });

    } catch (err) {
      console.error("❌ Error fetching all products for groups:", err);
    }
  };

  const fetchProducts = async (page = 1, search = "") => {
    if (!currentBranch?._id) {
      console.warn("⚠️  Branch not yet loaded in context");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const branchId = currentBranch._id;
      let url = `${API_BASE}/products?branchId=${branchId}&page=${page}&limit=50&includeRestocking=true`;
      
      // Add search parameter if search term exists
      if (search) {
        url += `&search=${encodeURIComponent(search)}`;
      }
      
      console.log("🔍 Fetching products from:", url);
      console.log("📄 Page:", page || 1);
      console.log("📌 Branch ID:", branchId);
      
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`API Error: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log("📦 Full API Response:", data);
      
      let productList = [];
      let paginationInfo = { total: 0, pages: 0, limit: 2000 };
      
      // API returns { success, data: [...], pagination: {...} }
      if (data?.data && Array.isArray(data.data)) {
        productList = data.data;
        paginationInfo = data.pagination || paginationInfo;
        console.log("✨ Extracted products from data.data:", productList.length, "items");
        console.log("📊 Pagination:", paginationInfo);
      } else if (Array.isArray(data)) {
        productList = data;
        console.log("✨ Response is direct array:", productList.length, "items");
      } else if (data?.products && Array.isArray(data.products)) {
        productList = data.products;
        paginationInfo = data.pagination || paginationInfo;
        console.log("✨ Extracted products from data.products:", productList.length, "items");
      } else {
        console.warn("⚠️  No products array found in response");
      }
      
      console.log("✅ Final product list:", productList);
      setProducts(productList);
      setPagination(paginationInfo);
      
      if (productList.length === 0) {
        toast.info("No products found for this branch");
      }
    } catch (err) {
      console.error("❌ Error fetching products:", err);
      toast.error(err.message || "Failed to fetch products");
    } finally {
      setLoading(false);
    }
  };

  // Fetch pending sales orders (not yet converted to invoice)
  const fetchPendingSales = async () => {
    if (!currentBranch?._id) return null;

    try {
      const res = await fetch(`${API_BASE}/sales-orders?branchId=${currentBranch._id}&generated=false&fromDate=2020-01-01&toDate=2030-12-31&limit=5000`);
      if (!res.ok) return null;

      const data = await res.json();
      let salesOrders = [];

      if (data?.data && Array.isArray(data.data)) {
        salesOrders = data.data;
      } else if (Array.isArray(data)) {
        salesOrders = data;
      }

      // Filter only pending (not invoiced) orders
      const pendingOrders = salesOrders.filter((so) => !so.invoiceGenerated);

      // Create a map of productId -> total pending qty
      const pendingMap = {};
      const detailsMap = {};
      pendingOrders.forEach((order) => {
        if (Array.isArray(order.items)) {
          order.items.forEach((item) => {
            const prodId = item.productId?._id || item.productId;
            if (prodId) {
              pendingMap[prodId] = (pendingMap[prodId] || 0) + (item.qty || 0);
              
              if (!detailsMap[prodId]) {
                detailsMap[prodId] = [];
              }
              const dateVal = order.orderDate || order.createdAt;
              const daysPending = Math.max(0, Math.floor((new Date() - new Date(dateVal)) / (1000 * 60 * 60 * 24)));
              detailsMap[prodId].push({
                invoiceId: order.invoiceId,
                customerName: order.customer?.name || "Unknown",
                qty: item.qty,
                date: dateVal,
                daysPending
              });
            }
          });
        }
      });

      console.log("📊 Pending Sales Map:", pendingMap);
      return { pendingMap, detailsMap };
    } catch (err) {
      console.error("❌ Error fetching pending sales:", err);
      return null;
    }
  };

  // Fetch pending purchase orders (status = PLACED)
  const fetchPendingPurchaseOrders = async () => {
    if (!currentBranch?._id) return null;

    try {
      // PLACED status represents pending (not yet received or invoiced) POs
      const res = await fetch(`${API_BASE}/purchase-orders?branchId=${currentBranch._id}&status=PLACED&limit=2000`);
      if (!res.ok) return null;

      const data = await res.json();
      let purchaseOrders = [];

      if (data?.data && Array.isArray(data.data)) {
        purchaseOrders = data.data;
      } else if (Array.isArray(data)) {
        purchaseOrders = data;
      }

      const pendingMap = {};
      purchaseOrders.forEach((order) => {
        if (Array.isArray(order.items)) {
          order.items.forEach((item) => {
            const prodId = item.productId?._id || item.productId;
            if (prodId) {
              pendingMap[prodId] = (pendingMap[prodId] || 0) + (item.qty || 0);
            }
          });
        }
      });

      console.log("📊 Pending PO Map:", pendingMap);
      return pendingMap;
    } catch (err) {
      console.error("❌ Error fetching pending purchase orders:", err);
      return null;
    }
  };

  const [pendingSalesMap, setPendingSalesMap] = useState(null);
  const [pendingSalesDetailsMap, setPendingSalesDetailsMap] = useState({});
  const [showPendingSalesPopup, setShowPendingSalesPopup] = useState(false);
  const [pendingPOMap, setPendingPOMap] = useState({});

  // Fetch both products, pending sales, and pending purchase orders
  const fetchAllData = async (page = 1, search = "") => {
    await fetchProducts(page, search);
    const pendingSalesData = await fetchPendingSales();
    if (pendingSalesData) {
      setPendingSalesMap(pendingSalesData.pendingMap || {});
      setPendingSalesDetailsMap(pendingSalesData.detailsMap || {});
    } else {
      setPendingSalesMap({});
      setPendingSalesDetailsMap({});
    }
    const pendingPO = await fetchPendingPurchaseOrders();
    setPendingPOMap(pendingPO || {});
  };

  // Handle search - reset to page 1
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page when searching
  };

  useEffect(() => {
    if (currentBranch?._id) {
      console.log("✅ Branch loaded:", currentBranch.name);
      setBranchLoaded(true);
      fetchAllData(currentPage, searchTerm);
      fetchProductGroupsDirectly(); // Load product groups INSTANTLY
      fetchAllProductsForGroups(); // Fetch all products for dynamic counts and global search caching
    } else {
      setBranchLoaded(false);
    }
  }, [currentBranch?._id]);

  // Handle page and search changes
  useEffect(() => {
    if (currentBranch?._id && branchLoaded) {
      fetchAllData(currentPage, searchTerm);
    }
  }, [currentPage, searchTerm]);

  // Categorize products by stock level
  const categorizeProducts = (prods) => {
    return {
      outOfStock: prods.filter((p) => p.totalQty === 0),
      lowStock: prods.filter(
        (p) => {
          const { reorderLevel } = getReorderParams(p);
          return p.totalQty > 0 && p.totalQty < reorderLevel;
        }
      ),
      normalStock: prods.filter(
        (p) => {
          const { reorderLevel } = getReorderParams(p);
          return p.totalQty >= reorderLevel && p.totalQty > 0;
        }
      ),
    };
  };

  // Get last PO info for vendor and voucher type
  const fetchLastPOForVendor = async (productId) => {
    try {
      const res = await fetch(
        `${API_BASE}/purchase-orders?branchId=${currentBranch._id}&limit=1&sort=-date`
      );
      const data = await res.json();
      return data && data.length > 0 ? data[0] : null;
    } catch (err) {
      console.error("Error fetching last PO:", err);
      return null;
    }
  };

  // Generate next voucher ID
  const generateNextVoucherId = (lastPO) => {
    if (!lastPO?.invoiceId) return `PO/001/${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
    
    const parts = lastPO.invoiceId.split("/");
    const prefix = parts[0]; // e.g., "ZONE1PO" or "PO"
    const currentNum = parseInt(parts[1]) || 0;
    const fyear = parts[2] || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
    
    return `${prefix}/${String(currentNum + 1).padStart(3, "0")}/${fyear}`;
  };

  const getPurchaseAgeString = (dateString) => {
    if (!dateString) return "-";
    const lastDate = new Date(dateString);
    const today = new Date();
    lastDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = today - lastDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const daysVal = diffDays < 0 ? 0 : diffDays;
    return `${daysVal}d`;
  };

  const getPurchaseDateString = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  // Handle restocking
  const handleRestock = async (product) => {
    const { reorderQty } = getReorderParams(product);
    const restockQty = reorderQty;
    if (!restockQty || restockQty === 0) {
      toast.error(`Restocking quantity not set for ${product.name}`);
      return;
    }

    setRestockingInProgress((prev) => ({ ...prev, [product._id]: true }));

    try {
      // Fetch last PO to get vendor and voucher type
      const lastPO = await fetchLastPOForVendor(product._id);
      const nextVoucherId = generateNextVoucherId(lastPO);

      // Determine vendor and voucher type
      const vendor = product.preferredVendor || lastPO?.vendor || "Default Vendor";
      const voucherType = lastPO?.voucherType || "standard";

      const poPayload = {
        branchId: currentBranch._id,
        invoiceId: nextVoucherId,
        voucherType,
        vendor,
        warehouse: lastPO?.warehouse || "",
        billingPerson: user?.id || "",
        items: [
          {
            productId: product._id,
            name: product.name,
            productGroup: product.productGroup,
            qty: restockQty,
            purchasePrice: product.purchasingPrice,
            sellingPrice: product.sellingPrice,
            hsn: product.hsn || product.hsnCode,
            gst: product.gst || 0,
            cgst: (product.gst || 0) / 2,
            sgst: (product.gst || 0) / 2,
            igst: false,
            subtotal: restockQty * product.purchasingPrice,
            tax: (restockQty * product.purchasingPrice * (product.gst || 0)) / 100,
            total: restockQty * product.purchasingPrice + (restockQty * product.purchasingPrice * (product.gst || 0)) / 100,
          },
        ],
        subtotal: restockQty * product.purchasingPrice,
        totalTax:
          (restockQty * product.purchasingPrice * product.gst) / 100,
        transportCharge: 0,
        grandTotal:
          restockQty * product.purchasingPrice +
          (restockQty * product.purchasingPrice * product.gst) / 100,
        status: "PLACED",
        date: new Date().toISOString(),
      };

      const res = await fetch(`${API_BASE}/purchase-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(poPayload),
      });

      const data = await res.json();

      if (data.success || res.ok) {
        toast.success(
          `✅ Restocking PO Created!\nInvoice: ${nextVoucherId}\nQty: ${restockQty} units`
        );
        fetchAllData(currentPage, searchTerm); // Refresh products and pending sales
      } else {
        toast.error(data.message || "Failed to create restocking PO");
      }
    } catch (err) {
      console.error("Error:", err);
      toast.error("Error creating restocking PO");
    } finally {
      setRestockingInProgress((prev) => ({ ...prev, [product._id]: false }));
    }
  };

  // Start editing product settings
  const startEditProduct = (product) => {
    setEditingProduct(product._id);
    setEditValues({
      reorderLevel: product.reorderLevel || 10,
      reorderQty: product.reorderQty || 20,
      preferredVendor: product.preferredVendor || "",
    });
  };

  // Save product configuration
  const saveProductConfig = async () => {
    if (!editingProduct) return;

    setSavingConfig(true);
    try {
      const res = await fetch(`${API_BASE}/products/${editingProduct}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editValues),
      });

      const data = await res.json();
      if (data.success || res.ok) {
        // Update local state immediately for real-time bucket changes
        setProducts((prevProducts) =>
          prevProducts.map((p) =>
            p._id === editingProduct
              ? { ...p, ...editValues }
              : p
          )
        );
        
        toast.success("✅ Product settings updated! Bucket updated immediately.");
        setEditingProduct(null);
      } else {
        toast.error(data.message || "Failed to save settings");
      }
    } catch (err) {
      console.error("Error:", err);
      toast.error("Error saving product settings");
    } finally {
      setSavingConfig(false);
    }
  };

  // Open restocking config modal
  const openRestockingConfigModal = (product) => {
    if (restockingConfigMode && restockingEditingProduct?._id === product._id) {
      setRestockingConfigMode(false);
      setRestockingEditingProduct(null);
      return;
    }
    setRestockingEditingProduct(product);
    setRestockingConfigMode(true);
    
    setRestockingFormValues({
      reorderMode: product.restockingConfig?.reorderMode || "HIGH",
      reorderQtyMode: product.restockingConfig?.reorderQtyMode || product.restockingConfig?.reorderMode || "HIGH",
      thresholdMode: product.restockingConfig?.thresholdMode || product.restockingConfig?.reorderMode || "HIGH",
      salesPeriodDays: product.restockingConfig?.salesPeriodDays || 7,
      sellingQtyInPeriod: product.restockingConfig?.sellingQtyInPeriod || 0,
      threshold: product.restockingConfig?.threshold !== undefined && product.restockingConfig?.threshold !== null ? product.restockingConfig.threshold : (product.reorderLevel || 10),
      restockingQty: product.restockingConfig?.restockingQty !== undefined && product.restockingConfig?.restockingQty !== null ? product.restockingConfig.restockingQty : (product.reorderQty || 20),
    });
  };

  // Calculate selling qty for the period
  const calculateSellingQty = async () => {
    if (!restockingEditingProduct || !restockingFormValues.salesPeriodDays) return;

    setCalculatingSellingQty(true);
    try {
      const productId = restockingEditingProduct._id;
      const days = restockingFormValues.salesPeriodDays;

      const res = await fetch(
        `${API_BASE}/products/${productId}/selling-qty/${days}?branchId=${currentBranch._id}`
      );

      if (!res.ok) throw new Error("Failed to calculate selling qty");

      const data = await res.json();
      if (data.success) {
        const calculatedQty = data.sellingQtyInPeriod || 0;
        
        setRestockingFormValues((prev) => ({
          ...prev,
          sellingQtyInPeriod: calculatedQty,
        }));
        
        toast.success(`✅ Calculated last ${days} days sales: ${calculatedQty} units!`);
      } else {
        toast.error(data.message || "Failed to calculate selling qty");
      }
    } catch (err) {
      console.error("Error calculating selling qty:", err);
      toast.error("Error calculating selling quantity");
    } finally {
      setCalculatingSellingQty(false);
    }
  };

  // Auto-calculate sales period qty when days change (debounced)
  useEffect(() => {
    if (!restockingEditingProduct || !restockingFormValues.salesPeriodDays) return;
    
    const delayDebounce = setTimeout(() => {
      const fetchQty = async () => {
        setCalculatingSellingQty(true);
        try {
          const productId = restockingEditingProduct._id;
          const days = restockingFormValues.salesPeriodDays;
          const res = await fetch(
            `${API_BASE}/products/${productId}/selling-qty/${days}?branchId=${currentBranch._id}`
          );
          if (!res.ok) throw new Error("Failed to calculate");
          const data = await res.json();
          if (data.success) {
            const calculatedQty = data.sellingQtyInPeriod || 0;
            setRestockingFormValues((prev) => ({
               ...prev,
               sellingQtyInPeriod: calculatedQty,
            }));
          }
        } catch (err) {
          console.error("Error auto-calculating:", err);
        } finally {
          setCalculatingSellingQty(false);
        }
      };
      fetchQty();
    }, 500); // 500ms debounce
    
    return () => clearTimeout(delayDebounce);
  }, [restockingFormValues.salesPeriodDays, restockingEditingProduct?._id]);


  // Save restocking configuration
  const saveRestockingConfig = async () => {
    if (!restockingEditingProduct) return;

    setSavingRestockingConfig(true);
    try {
      const payload = {
        salesPeriodDays: restockingFormValues.salesPeriodDays,
        sellingQtyInPeriod: restockingFormValues.sellingQtyInPeriod,
        threshold: restockingFormValues.threshold,
        restockingQty: restockingFormValues.restockingQty,
        reorderMode: restockingFormValues.reorderQtyMode || "HIGH",
        reorderQtyMode: restockingFormValues.reorderQtyMode || "HIGH",
        thresholdMode: restockingFormValues.thresholdMode || "HIGH",
      };

      const res = await fetch(
        `${API_BASE}/products/${restockingEditingProduct._id}/restocking-config`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();
      if (data.success || res.ok) {
        // Update local product state
        setProducts((prevProducts) =>
          prevProducts.map((p) =>
            p._id === restockingEditingProduct._id
              ? { ...p, restockingConfig: data.restockingConfig || payload }
              : p
          )
        );

        toast.success("✅ Restocking configuration saved successfully!");
        setRestockingConfigMode(false);
        setRestockingEditingProduct(null);
        
        // Refresh to make sure everything is completely in sync
        fetchAllData(currentPage, searchTerm);
      } else {
        toast.error(data.message || "Failed to save restocking config");
      }
    } catch (err) {
      console.error("Error saving restocking config:", err);
      toast.error("Error saving restocking configuration");
    } finally {
      setSavingRestockingConfig(false);
    }
  };

  // Apply sales period to all selected products in bulk (recalculate & save)
  const applyBulkSalesPeriod = async (days) => {
    if (selectedProducts.size === 0) return;
    setSavingBulkConfig(true);
    try {
      const selectedIds = Array.from(selectedProducts);
      
      const promises = selectedIds.map(async (productId) => {
        // 1. Fetch calculated sales qty for this product
        const qtyRes = await fetch(
          `${API_BASE}/products/${productId}/selling-qty/${days}?branchId=${currentBranch._id}`
        );
        if (!qtyRes.ok) throw new Error(`Failed to calculate sales for product ID: ${productId}`);
        const qtyData = await qtyRes.json();
        const calculatedQty = qtyData.sellingQtyInPeriod || 0;

        // 2. Find product in allProducts or products to preserve existing configs
        const product = allProducts.find((p) => p._id === productId) || products.find((p) => p._id === productId);
        const currentConfig = product?.restockingConfig || {};

        const payload = {
          salesPeriodDays: days,
          sellingQtyInPeriod: calculatedQty,
          threshold: currentConfig.threshold !== undefined && currentConfig.threshold !== null ? currentConfig.threshold : (product?.reorderLevel || 10),
          restockingQty: currentConfig.restockingQty !== undefined && currentConfig.restockingQty !== null ? currentConfig.restockingQty : (product?.reorderQty || 20),
          reorderMode: currentConfig.reorderQtyMode || currentConfig.reorderMode || "HIGH",
          reorderQtyMode: currentConfig.reorderQtyMode || currentConfig.reorderMode || "HIGH",
          thresholdMode: currentConfig.thresholdMode || currentConfig.reorderMode || "HIGH",
        };

        // 3. Put request to save
        const saveRes = await fetch(
          `${API_BASE}/products/${productId}/restocking-config`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
        if (!saveRes.ok) throw new Error(`Failed to save config for product ID: ${productId}`);
        const saveData = await saveRes.json();
        return { productId, restockingConfig: saveData.restockingConfig || payload };
      });

      const results = await Promise.all(promises);

      // Update state for all products in scope
      setProducts((prevProducts) =>
        prevProducts.map((p) => {
          const match = results.find((r) => r.productId === p._id);
          return match ? { ...p, restockingConfig: match.restockingConfig } : p;
        })
      );
      setAllProducts((prevAllProducts) =>
        prevAllProducts.map((p) => {
          const match = results.find((r) => r.productId === p._id);
          return match ? { ...p, restockingConfig: match.restockingConfig } : p;
        })
      );

      toast.success(
        `✅ Recalculated and updated sales period to ${days} days for ${selectedIds.length} products!`
      );
      setSelectedProducts(new Set()); // Clear checkboxes
      fetchAllData(currentPage, searchTerm); // Refresh list
    } catch (err) {
      console.error("Bulk sales period update error:", err);
      toast.error(`Error saving bulk settings: ${err.message}`);
    } finally {
      setSavingBulkConfig(false);
    }
  };

  // Export filtered products to Excel
  const handleExportExcel = () => {
    try {
      const exportList = filteredProducts;
      if (exportList.length === 0) {
        toast.info("No products to export.");
        return;
      }

      toast.info("Preparing Excel export...");

      const exportData = exportList.map((product) => {
        const { reorderQty, reorderLevel, isAuto } = getReorderParams(product);
        const poQty = pendingPOMap?.[product._id] || 0;
        const soQty = pendingSalesMap?.[product._id] || 0;
        const netAvailability = Number(((product.totalQty || 0) + poQty - soQty).toFixed(2));
        
        const stockStatus = 
          product.totalQty === 0 ? "Out of Stock" :
          product.totalQty <= reorderLevel ? "Low Stock" :
          "Normal";

        const purDate = product.lastPurchaseDate ? new Date(product.lastPurchaseDate).toLocaleDateString('en-GB') : "-";
        const salDate = product.lastSalesDate ? new Date(product.lastSalesDate).toLocaleDateString('en-GB') : "-";

        const getAgeInDays = (dateStr) => {
          if (!dateStr) return "-";
          const lastDate = new Date(dateStr);
          const today = new Date();
          lastDate.setHours(0, 0, 0, 0);
          today.setHours(0, 0, 0, 0);
          const diffDays = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
          return diffDays < 0 ? "0 days" : `${diffDays} days`;
        };

        const purAge = getAgeInDays(product.lastPurchaseDate);
        const salAge = getAgeInDays(product.lastSalesDate);

        const groupName = product.productGroup && typeof product.productGroup === 'object' 
          ? (product.productGroup.name || product.productGroup._id)
          : (product.productGroup || "-");

        return {
          "Product Name": product.name || "-",
          "Product Group": groupName,
          "Unit": product.units || "-",
          "System Qty": Number((product.totalQty || 0).toFixed(2)),
          "PO Qty": poQty,
          "Last Purchase Date": purDate,
          "Purchase Age": purAge,
          "Last Sales Date": salDate,
          "Sales Age": salAge,
          "SO Qty": soQty,
          "Net Available Qty": netAvailability,
          "Min Level (Threshold)": reorderLevel,
          "Reorder Qty": reorderQty,
          "Reorder Mode": isAuto ? "AUTO" : "MANUAL",
          "Status": stockStatus,
          "Preferred Vendor": product.preferredVendor || "-",
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Restocking Report");

      // Auto-width adjustment for columns
      const wscols = [
        { wch: 35 }, // Product Name
        { wch: 20 }, // Product Group
        { wch: 10 }, // Unit
        { wch: 12 }, // System Qty
        { wch: 10 }, // PO Qty
        { wch: 18 }, // Last Purchase Date
        { wch: 15 }, // Purchase Age
        { wch: 18 }, // Last Sales Date
        { wch: 15 }, // Sales Age
        { wch: 10 }, // SO Qty
        { wch: 18 }, // Net Available Qty
        { wch: 22 }, // Min Level (Threshold)
        { wch: 15 }, // Reorder Qty
        { wch: 15 }, // Reorder Mode
        { wch: 15 }, // Status
        { wch: 25 }, // Preferred Vendor
      ];
      worksheet['!cols'] = wscols;

      const groupLabel = selectedProductGroup === "All" ? "AllGroups" : selectedProductGroup;
      const fileName = `RestockingReport_${groupLabel}_${new Date().toISOString().split('T')[0]}.xlsx`;

      XLSX.writeFile(workbook, fileName);
      toast.success("Excel report exported successfully!");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export Excel report");
    }
  };

  // Toggle product selection for bulk restocking
  const toggleProductSelection = (productId) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  // Bulk restock selected products - SHOW PREVIEW
  const handleBulkRestock = () => {
    if (selectedProducts.size === 0) {
      toast.error("Please select at least one product");
      return;
    }

    // Use allProducts if available (includes products from all groups), otherwise fall back to products
    const sourceProducts = allProducts.length > 0 ? allProducts : products;
    const selectedProds = sourceProducts.filter((p) => selectedProducts.has(p._id));

    // Validate we found all selected products
    if (selectedProds.length === 0) {
      toast.error("❌ Selected products not found in database");
      console.error("Selected IDs:", Array.from(selectedProducts));
      console.error("Source products:", sourceProducts.map(p => p._id));
      return;
    }

    if (selectedProds.length !== selectedProducts.size) {
      console.warn(`⚠️ Only found ${selectedProds.length} of ${selectedProducts.size} selected products`);
    }

    // Validate all products have same vendor
    const vendors = new Set(selectedProds.map((p) => p.preferredVendor || "Default Vendor"));
    if (vendors.size > 1) {
      toast.error("⚠️ All selected products must be from the SAME vendor for single PO");
      return;
    }

    // Initialize preview with editable qty from dynamic resolved qty
    const previewItems = selectedProds.map((p) => {
      const { reorderQty } = getReorderParams(p);
      return {
        ...p,
        previewQty: reorderQty,
      };
    });

    setBulkRestockPreviewItems(previewItems);
    
    // Initialize edit qty state with dynamic resolved qty
    const qtyMap = {};
    previewItems.forEach((item) => {
      const { reorderQty } = getReorderParams(item);
      qtyMap[item._id] = reorderQty;
    });
    setBulkRestockEditQty(qtyMap);

    setBulkRestockPreviewMode(true);
  };

  // Confirm bulk restock and create PO
  const confirmBulkRestock = async () => {
    if (bulkRestockPreviewItems.length === 0) return;

    setBulkRestockingInProgress(true);

    try {
      // Fetch last PO to generate next voucher ID
      const lastPOResponse = await fetch(
        `${API_BASE}/purchase-orders?branchId=${currentBranch._id}&limit=1&sort=-date`
      );
      const lastPOData = await lastPOResponse.json();
      const lastPO = lastPOData && Array.isArray(lastPOData) ? lastPOData[0] : null;
      const nextVoucherId = generateNextVoucherId(lastPO);

      // Get vendor from first product (all validated to be same)
      const vendor = bulkRestockPreviewItems[0].preferredVendor || lastPO?.vendor || "Default Vendor";
      const voucherType = lastPO?.voucherType || "standard";

      // Build items array with EDITED quantities
      let subtotal = 0;
      let totalTax = 0;

      const items = bulkRestockPreviewItems
        .map((product) => {
          const { reorderQty } = getReorderParams(product);
          const qty = bulkRestockEditQty[product._id] !== undefined ? bulkRestockEditQty[product._id] : reorderQty;
          return { product, qty };
        })
        .filter(({ qty }) => qty > 0)
        .map(({ product, qty }) => {
          const itemSubtotal = qty * product.purchasingPrice;
          const itemTax = (itemSubtotal * (product.gst || 0)) / 100;
          const itemTotal = itemSubtotal + itemTax;

          subtotal += itemSubtotal;
          totalTax += itemTax;

          return {
            productId: product._id,
            name: product.name,
            productGroup: product.productGroup,
            qty, // Use edited qty
            purchasePrice: product.purchasingPrice,
            sellingPrice: product.sellingPrice,
            hsn: product.hsn || product.hsnCode,
            gst: product.gst || 0,
            cgst: (product.gst || 0) / 2,
            sgst: (product.gst || 0) / 2,
            igst: false,
            subtotal: itemSubtotal,
            tax: itemTax,
            total: itemTotal,
          };
        });

      if (items.length === 0) {
        toast.error("Please specify a quantity greater than 0 for at least one item.");
        setBulkRestockingInProgress(false);
        return;
      }

      const grandTotal = subtotal + totalTax;

      // Create SINGLE purchase order with all items
      const poPayload = {
        branchId: currentBranch._id,
        invoiceId: nextVoucherId,
        voucherType,
        vendor,
        warehouse: lastPO?.warehouse || "",
        billingPerson: user?.id || "",
        items,
        subtotal,
        totalTax,
        transportCharge: 0,
        grandTotal,
        status: "PLACED",
        date: new Date().toISOString(),
      };

      const res = await fetch(`${API_BASE}/purchase-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(poPayload),
      });

      const data = await res.json();

      if (data.success || res.ok) {
        toast.success(
          `✅ Grouped Restocking PO Created!\nInvoice: ${nextVoucherId}\nItems: ${bulkRestockPreviewItems.length}\nTotal: ₹${grandTotal.toFixed(2)}`
        );
        setSelectedProducts(new Set());
        setBulkRestockPreviewMode(false);
        setBulkRestockPreviewItems([]);
        setBulkRestockEditQty({});
        fetchAllData(currentPage, searchTerm);
      } else {
        toast.error(data.message || "Failed to create restocking PO");
      }
    } catch (err) {
      console.error("Error:", err);
      toast.error("Error creating restocking PO");
    } finally {
      setBulkRestockingInProgress(false);
    }
  };

  // Sorting logic for products
  const getSortedProducts = (prods) => {
    return [...prods].sort((a, b) => {
      const { key, direction } = sortConfig;
      
      if (key === "status") {
        // Priority: Out of Stock (0) > Low (1) > Normal (2)
        const getStatusPriority = (p) => {
          const { reorderLevel } = getReorderParams(p);
          const qty = p.totalQty !== undefined && p.totalQty !== null ? Number(p.totalQty) : 0;
          if (qty <= 0) return 0;
          if (qty <= reorderLevel) return 1;
          return 2;
        };
        const priorityA = getStatusPriority(a);
        const priorityB = getStatusPriority(b);
        return direction === "asc" ? priorityA - priorityB : priorityB - priorityA;
      }
      
      if (key === "name") {
        const nameA = (a.name || "").toLowerCase();
        const nameB = (b.name || "").toLowerCase();
        if (nameA < nameB) return direction === "asc" ? -1 : 1;
        if (nameA > nameB) return direction === "asc" ? 1 : -1;
        return 0;
      }
      
      if (key === "units") {
        const valA = (a.units || "").toLowerCase();
        const valB = (b.units || "").toLowerCase();
        if (valA < valB) return direction === "asc" ? -1 : 1;
        if (valA > valB) return direction === "asc" ? 1 : -1;
        return 0;
      }

      if (key === "totalQty") {
        let valA = a.totalQty !== undefined && a.totalQty !== null ? Number(a.totalQty) : 0;
        let valB = b.totalQty !== undefined && b.totalQty !== null ? Number(b.totalQty) : 0;
        if (isNaN(valA)) valA = 0;
        if (isNaN(valB)) valB = 0;

        if (a.name.toLowerCase().includes("amul strawberry") || b.name.toLowerCase().includes("amul strawberry")) {
          console.log(`[SORT DEBUG] Comparing: "${a.name}" (${valA}) vs "${b.name}" (${valB}) | Dir: ${direction} | Result: ${direction === "asc" ? valA - valB : valB - valA}`);
        }
        
        return direction === "asc" ? valA - valB : valB - valA;
      }

      if (key === "pendingSales") {
        const pendingA = Number(pendingSalesMap?.[a._id]) || 0;
        const pendingB = Number(pendingSalesMap?.[b._id]) || 0;
        return direction === "asc" ? pendingA - pendingB : pendingB - pendingA;
      }

      if (key === "pendingPO") {
        const poA = Number(pendingPOMap?.[a._id]) || 0;
        const poB = Number(pendingPOMap?.[b._id]) || 0;
        return direction === "asc" ? poA - poB : poB - poA;
      }

      if (key === "netAvailability") {
        const soA = Number(pendingSalesMap?.[a._id]) || 0;
        const poA = Number(pendingPOMap?.[a._id]) || 0;
        const qtyA = a.totalQty !== undefined && a.totalQty !== null ? Number(a.totalQty) : 0;
        const netA = qtyA + poA - soA;

        const soB = Number(pendingSalesMap?.[b._id]) || 0;
        const poB = Number(pendingPOMap?.[b._id]) || 0;
        const qtyB = b.totalQty !== undefined && b.totalQty !== null ? Number(b.totalQty) : 0;
        const netB = qtyB + poB - soB;

        return direction === "asc" ? netA - netB : netB - netA;
      }

      if (key === "available") {
        const qtyA = a.totalQty !== undefined && a.totalQty !== null ? Number(a.totalQty) : 0;
        const qtyB = b.totalQty !== undefined && b.totalQty !== null ? Number(b.totalQty) : 0;
        const availA = Math.max(0, qtyA - (Number(pendingSalesMap?.[a._id]) || 0));
        const availB = Math.max(0, qtyB - (Number(pendingSalesMap?.[b._id]) || 0));
        return direction === "asc" ? availA - availB : availB - availA;
      }

      if (key === "threshold") {
        const threshA = Number(getReorderParams(a).reorderLevel) || 0;
        const threshB = Number(getReorderParams(b).reorderLevel) || 0;
        return direction === "asc" ? threshA - threshB : threshB - threshA;
      }

      if (key === "restockingQty") {
        const qtyA = Number(getReorderParams(a).reorderQty) || 0;
        const qtyB = Number(getReorderParams(b).reorderQty) || 0;
        return direction === "asc" ? qtyA - qtyB : qtyB - qtyA;
      }

      if (key === "preferredVendor") {
        const valA = (a.preferredVendor?.name || a.preferredVendor || "").toLowerCase();
        const valB = (b.preferredVendor?.name || b.preferredVendor || "").toLowerCase();
        if (valA < valB) return direction === "asc" ? -1 : 1;
        if (valA > valB) return direction === "asc" ? 1 : -1;
        return 0;
      }

      if (key === "lastPurchaseDate" || key === "purchaseAge") {
        const valA = a.lastPurchaseDate ? new Date(a.lastPurchaseDate).getTime() : 0;
        const valB = b.lastPurchaseDate ? new Date(b.lastPurchaseDate).getTime() : 0;
        return direction === "asc" ? valA - valB : valB - valA;
      }

      if (key === "lastSalesDate" || key === "salesAge") {
        const valA = a.lastSalesDate ? new Date(a.lastSalesDate).getTime() : 0;
        const valB = b.lastSalesDate ? new Date(b.lastSalesDate).getTime() : 0;
        return direction === "asc" ? valA - valB : valB - valA;
      }
    });
  };

  // Use allProducts for global sorting and filtering if available
  const baseProducts = allProducts.length > 0 ? allProducts : products;

  // Global filtering for all products
  const getFilteredAndSorted = (prods) => {
    const filtered = prods.filter(p => {
      // Group filter
      if (selectedProductGroup !== "All") {
        const groupName = p.productGroup && typeof p.productGroup === 'object' 
          ? (p.productGroup.name || p.productGroup._id)
          : p.productGroup;
        if (groupName !== selectedProductGroup) return false;
      }
      
      // Search filter
      if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        const matchesName = p.name?.toLowerCase().includes(lowerSearch);
        const matchesSku = p.sku?.toLowerCase().includes(lowerSearch);
        if (!matchesName && !matchesSku) return false;
      }
      
      return true;
    });
    
    return getSortedProducts(filtered);
  };

  const filteredProducts = getFilteredAndSorted(baseProducts);

  // Client-side pagination for the filtered/sorted list
  const totalFilteredPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Categorization for card view based on global filtered list (showing all action required)
  const { 
    outOfStock: filteredOutOfStock, 
    lowStock: filteredLowStock, 
    normalStock: filteredNormalStock 
  } = categorizeProducts(filteredProducts);

  const StockCategory = ({ title, products: prods, icon: Icon, bgColor, textColor, borderColor }) => (
    <div className="mb-8">
      <div className={`flex items-center gap-3 mb-4 pb-3 border-b-2 ${borderColor}`}>
        <Icon className={`text-2xl ${textColor}`} />
        <h2 className={`text-xl font-bold ${textColor}`}>{title}</h2>
        <span className={`ml-auto px-3 py-1 rounded-full text-sm font-semibold ${bgColor}`}>
          {prods.length}
        </span>
      </div>

      {prods.length === 0 ? (
        <p className="text-gray-500 text-center py-4">No products in this category</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {prods.map((product) => {
            const { reorderQty, reorderLevel, isAuto } = getReorderParams(product);
            const poQty = pendingPOMap?.[product._id] || 0;
            const soQty = pendingSalesMap?.[product._id] || 0;
            const netAvailability = Number(((product.totalQty || 0) + poQty - soQty).toFixed(2));
            const isEditingThisProduct = restockingConfigMode && restockingEditingProduct?._id === product._id;

            return (
              <div
                key={product._id}
                className={`${bgColor} border-l-4 ${borderColor} p-5 rounded-lg shadow hover:shadow-lg transition relative`}
              >
                {/* Checkbox for bulk selection */}
                <div className="absolute top-4 right-4">
                  <input
                    type="checkbox"
                    checked={selectedProducts.has(product._id)}
                    onChange={() => toggleProductSelection(product._id)}
                    className="w-5 h-5 cursor-pointer"
                  />
                </div>

                <div className="flex justify-between items-start mb-3 pr-8">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-800 text-sm mb-1">
                      {product.name}
                    </h3>
                    <p className="text-xs text-gray-600">{product.units}</p>
                  </div>
                </div>

                <div className="space-y-2 mb-4 text-sm">
                  {fieldPermissions.totalQty !== false && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">System Qty (Closing):</span>
                      <div className="text-sm font-semibold text-gray-800">
                        {Number((product.totalQty || 0).toFixed(2))} {product.units}
                      </div>
                    </div>
                  )}

                  {fieldPermissions.totalQty !== false && poQty > 0 && (
                    <div className="flex justify-between bg-indigo-50/50 p-2 rounded border-l-2 border-indigo-400">
                      <span className="text-indigo-700 font-medium">⏳ Purchase Order Qty:</span>
                      <span className="font-bold text-indigo-800">
                        {poQty} {product.units}
                      </span>
                    </div>
                  )}

                  {fieldPermissions.totalQty !== false && soQty > 0 && (
                    <div className="flex justify-between bg-amber-50/50 p-2 rounded border-l-2 border-amber-400">
                      <span className="text-amber-700 font-medium">⏳ Sales Order Qty:</span>
                      <span className="font-bold text-amber-800">
                        {soQty} {product.units}
                      </span>
                    </div>
                  )}

                  {fieldPermissions.totalQty !== false && (
                    <div className="flex justify-between bg-blue-50/50 p-2 rounded border-l-2 border-blue-400">
                      <span className="text-blue-700 font-medium">✓ Net Availability:</span>
                      <span className={`font-extrabold ${netAvailability <= reorderLevel ? "text-red-700" : "text-blue-800"}`}>
                        {netAvailability} {product.units}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span className="text-gray-600">Reorder Level:</span>
                    <span className="font-semibold text-gray-800">
                      {reorderLevel}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Reorder Qty:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-gray-800">{reorderQty}</span>
                      <span className={`text-[8px] px-1 py-0.5 rounded font-bold ${
                        isAuto ? "bg-purple-100 text-purple-700" : "bg-teal-100 text-teal-700"
                      }`}>
                        {isAuto ? "AUTO" : "MANUAL"}
                      </span>
                    </div>
                  </div>

                  {product.preferredVendor && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Vendor:</span>
                      <span className="font-semibold text-gray-800">
                        {product.preferredVendor}
                      </span>
                    </div>
                  )}

                  {netAvailability < reorderLevel && (
                    <div className="bg-amber-50 border border-amber-200/60 p-2 rounded-lg flex items-center justify-between text-xs text-amber-800 font-bold mt-1.5 shadow-sm">
                      <span>💡 Suggest Restock:</span>
                      <span className="bg-amber-100 text-amber-950 px-1.5 py-0.5 rounded font-extrabold">{reorderQty - netAvailability} {product.units}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {actionPermissions.edit !== false && (
                    <button
                      onClick={() => openRestockingConfigModal(product)}
                      className={`w-full py-2 px-3 rounded font-semibold text-sm transition border-2 flex items-center justify-center gap-2 ${
                        isEditingThisProduct
                          ? "bg-purple-600 text-white border-purple-600 hover:bg-purple-700"
                          : "border-purple-500 text-purple-600 hover:bg-purple-50"
                      }`}
                    >
                      {isEditingThisProduct ? "✕ Close Settings" : <><FaEdit /> Edit Settings</>}
                    </button>
                  )}
                  {actionPermissions.restock !== false && (
                    <button
                      onClick={() => handleRestock(product)}
                      disabled={
                        restockingInProgress[product._id] || !reorderQty
                      }
                      className={`w-full py-2 px-3 rounded font-semibold text-sm transition flex items-center justify-center gap-2 ${
                        restockingInProgress[product._id]
                          ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                          : reorderQty
                          ? "bg-green-500 text-white hover:bg-green-600"
                          : "bg-gray-300 text-gray-600 cursor-not-allowed"
                      }`}
                    >
                      <FaArrowUp />
                      {restockingInProgress[product._id]
                        ? "Processing..."
                        : "Restock Now"}
                    </button>
                  )}
                </div>
                {isEditingThisProduct && (
                  <div className="mt-4 pt-4 border-t border-purple-200/50 w-full">
                    {renderInlineConfig(product)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // Edit Settings Modal
  const EditModal = () => {
    const product = products.find((p) => p._id === editingProduct);
    if (!product) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
          <div className="bg-blue-600 text-white p-6 rounded-t-xl">
            <h2 className="text-2xl font-bold">⚙️ Edit Restocking Settings</h2>
            <p className="text-blue-100 mt-1">{product.name}</p>
          </div>

          <div className="p-6 space-y-5">
            {/* Threshold */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Reorder Threshold (Low Stock Alert)
              </label>
              <input
                type="number"
                value={editValues.reorderLevel}
                onChange={(e) =>
                  setEditValues({
                    ...editValues,
                    reorderLevel: e.target.value === "" ? "" : parseInt(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 10"
              />
              <p className="text-xs text-gray-500 mt-1">
                Alert when stock falls below this qty
              </p>
            </div>

            {/* Restock Qty */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Reorder Quantity
              </label>
              <input
                type="number"
                value={editValues.reorderQty}
                onChange={(e) =>
                  setEditValues({
                    ...editValues,
                    reorderQty: e.target.value === "" ? "" : parseInt(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 20"
              />
              <p className="text-xs text-gray-500 mt-1">
                How much to order when threshold is reached
              </p>
            </div>

            {/* Preferred Vendor */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Preferred Vendor (Optional)
              </label>
              <input
                type="text"
                value={editValues.preferredVendor}
                onChange={(e) =>
                  setEditValues({ ...editValues, preferredVendor: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., M.B.AGENCIES"
              />
              <p className="text-xs text-gray-500 mt-1">
                Auto-used for restocking POs
              </p>
            </div>

            {/* Current Stats */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-600">
                <strong>Current Stock:</strong> {Number((product.totalQty || 0).toFixed(2))} {product.units}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                <strong>Purchasing Price:</strong> ₹{product.purchasingPrice}
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div className="bg-gray-50 px-6 py-4 rounded-b-xl flex gap-3">
            <button
              onClick={() => setEditingProduct(null)}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-100 transition"
            >
              Cancel
            </button>
            <button
              onClick={saveProductConfig}
              disabled={savingConfig}
              className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-50"
            >
              {savingConfig ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Inline Restocking Configuration Details
  const renderInlineConfig = (product) => {
    if (!product) return null;

    const reorderMode = restockingFormValues.reorderMode || "HIGH";
    const reorderQtyMode = restockingFormValues.reorderQtyMode || reorderMode;
    const thresholdMode = restockingFormValues.thresholdMode || reorderMode;
    const isHigh = reorderMode === "HIGH";

    const poQty = pendingPOMap?.[product._id] || 0;
    const soQty = pendingSalesMap?.[product._id] || 0;
    const netAvailability = Number(((product.totalQty || 0) + poQty - soQty).toFixed(2));

    const autoQty = (restockingFormValues.sellingQtyInPeriod !== undefined && restockingFormValues.sellingQtyInPeriod !== null)
      ? restockingFormValues.sellingQtyInPeriod
      : (product.reorderQty || 20);
    const autoThreshold = restockingFormValues.sellingQtyInPeriod || product.reorderLevel || 10;

    const manualQty = restockingFormValues.restockingQty !== undefined && restockingFormValues.restockingQty !== null
      ? restockingFormValues.restockingQty
      : (product.reorderQty || 20);
    const manualThreshold = restockingFormValues.threshold !== undefined && restockingFormValues.threshold !== null
      ? restockingFormValues.threshold
      : (product.reorderLevel || 10);

    let resolvedQty, resolvedThreshold;
    if (reorderQtyMode === "LOW") {
      resolvedQty = Math.min(autoQty, manualQty);
    } else {
      resolvedQty = Math.max(autoQty, manualQty);
    }

    if (thresholdMode === "LOW") {
      resolvedThreshold = Math.min(autoThreshold, manualThreshold);
    } else {
      resolvedThreshold = Math.max(autoThreshold, manualThreshold);
    }

    return (
      <div className="bg-slate-50/90 rounded-2xl border border-purple-200/80 p-5 mt-2 shadow-inner space-y-4 text-gray-700 text-xs transition-all duration-300 w-full text-left font-sans">
        <div className="flex items-center justify-between border-b pb-2.5 border-slate-200/50">
          <span className="text-xs font-black text-purple-950 flex items-center gap-1.5">
            ⚙️ Restocking Configuration for <span className="text-purple-600 font-extrabold">{product.name}</span>
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded font-extrabold uppercase bg-purple-100 text-purple-700">
            📊 TALLY FORMAT RULE SETTING
          </span>
        </div>

        {/* Sales Period Settings for Auto Calculations */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white/80 p-3 rounded-xl border border-slate-200/50">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700 text-xs">🤖 Sales Period for Auto calculations:</span>
            <input
              type="number"
              value={restockingFormValues.salesPeriodDays !== undefined ? restockingFormValues.salesPeriodDays : 7}
              onChange={(e) => setRestockingFormValues(prev => ({
                ...prev,
                salesPeriodDays: e.target.value === "" ? "" : parseInt(e.target.value)
              }))}
              className="w-16 px-2.5 py-1 border border-indigo-200 rounded text-xs font-bold text-center focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
            />
            <span className="text-slate-500 font-bold text-[11px]">Days</span>
          </div>
          <div className="text-slate-500 text-xs font-bold">
            Calculated Sales in Period: <span className="text-indigo-700 font-black">{restockingFormValues.sellingQtyInPeriod || 0} {product.units}</span>
          </div>
        </div>

        {/* Tally Format Rules Grid */}
        <div className="bg-white rounded-xl border border-slate-200/50 overflow-hidden shadow-inner">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold uppercase text-[9px] tracking-wider">
                <th className="p-3">Restock Parameter</th>
                <th className="p-3 text-center">🤖 Auto (Sales)</th>
                <th className="p-3 text-center">🔄 Mode Toggle</th>
                <th className="p-3 text-center">✍️ Manual Override</th>
                <th className="p-3 text-right bg-slate-900/5 font-black text-slate-800">Resolved Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {/* Order Quantity Row */}
              <tr className="hover:bg-slate-50/50">
                <td className="p-3">
                  <div className="font-bold text-slate-800 text-[11px]">Order Quantity</div>
                  <div className="text-[10px] text-slate-400 font-normal">Amount to purchase/restock when triggered</div>
                </td>
                <td className="p-3 text-center font-bold text-indigo-600">
                  {autoQty} {product.units}
                </td>
                <td className="p-3 text-center">
                  <div className="inline-flex p-1 bg-slate-100 rounded-lg border border-slate-200/60">
                    <button
                      type="button"
                      onClick={() => setRestockingFormValues(prev => ({ ...prev, reorderQtyMode: "HIGH" }))}
                      className={`py-1 px-3 rounded font-black text-[10px] transition-all duration-200 cursor-pointer ${
                        reorderQtyMode === "HIGH" 
                          ? "bg-purple-600 text-white shadow-sm" 
                          : "text-slate-600 hover:bg-slate-200/50"
                      }`}
                    >
                      🚀 High (Max)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRestockingFormValues(prev => ({ ...prev, reorderQtyMode: "LOW" }))}
                      className={`py-1 px-3 rounded font-black text-[10px] transition-all duration-200 cursor-pointer ${
                        reorderQtyMode === "LOW" 
                          ? "bg-amber-500 text-white shadow-sm" 
                          : "text-slate-600 hover:bg-slate-200/50"
                      }`}
                    >
                      🛠️ Low (Min)
                    </button>
                  </div>
                </td>
                <td className="p-3 text-center">
                  <div className="inline-flex items-center gap-1.5 justify-center">
                    <input
                      type="number"
                      value={restockingFormValues.restockingQty !== undefined && restockingFormValues.restockingQty !== null ? restockingFormValues.restockingQty : ""}
                      onChange={(e) => setRestockingFormValues(prev => ({
                        ...prev,
                        restockingQty: e.target.value === "" ? "" : parseInt(e.target.value)
                      }))}
                      className="w-24 px-2 py-1 border border-slate-200 rounded text-center font-bold focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white"
                      placeholder={product.reorderQty}
                    />
                    <span className="text-slate-400 font-semibold text-[10px]">{product.units}</span>
                  </div>
                </td>
                <td className="p-3 text-right bg-slate-900/5 font-extrabold text-green-600 text-xs">
                  {resolvedQty} {product.units}
                </td>
              </tr>

              {/* Threshold Level Row */}
              <tr className="hover:bg-slate-50/50">
                <td className="p-3">
                  <div className="font-bold text-slate-800 text-[11px]">Trigger Threshold (Min Lvl)</div>
                  <div className="text-[10px] text-slate-400 font-normal">Stock level at which restocking triggers</div>
                </td>
                <td className="p-3 text-center font-bold text-indigo-600">
                  {autoThreshold} {product.units}
                </td>
                <td className="p-3 text-center">
                  <div className="inline-flex p-1 bg-slate-100 rounded-lg border border-slate-200/60">
                    <button
                      type="button"
                      onClick={() => setRestockingFormValues(prev => ({ ...prev, thresholdMode: "HIGH" }))}
                      className={`py-1 px-3 rounded font-black text-[10px] transition-all duration-200 cursor-pointer ${
                        thresholdMode === "HIGH" 
                          ? "bg-purple-600 text-white shadow-sm" 
                          : "text-slate-600 hover:bg-slate-200/50"
                      }`}
                    >
                      🚀 High (Max)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRestockingFormValues(prev => ({ ...prev, thresholdMode: "LOW" }))}
                      className={`py-1 px-3 rounded font-black text-[10px] transition-all duration-200 cursor-pointer ${
                        thresholdMode === "LOW" 
                          ? "bg-amber-500 text-white shadow-sm" 
                          : "text-slate-600 hover:bg-slate-200/50"
                      }`}
                    >
                      🛠️ Low (Min)
                    </button>
                  </div>
                </td>
                <td className="p-3 text-center">
                  <div className="inline-flex items-center gap-1.5 justify-center">
                    <input
                      type="number"
                      value={restockingFormValues.threshold !== undefined && restockingFormValues.threshold !== null ? restockingFormValues.threshold : ""}
                      onChange={(e) => setRestockingFormValues(prev => ({
                        ...prev,
                        threshold: e.target.value === "" ? "" : parseInt(e.target.value)
                      }))}
                      className="w-24 px-2 py-1 border border-slate-200 rounded text-center font-bold focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white"
                      placeholder={product.reorderLevel}
                    />
                    <span className="text-slate-400 font-semibold text-[10px]">{product.units}</span>
                  </div>
                </td>
                <td className="p-3 text-right bg-slate-900/5 font-extrabold text-amber-600 text-xs">
                  {resolvedThreshold} {product.units}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Live stock details and Pending Sales button */}
        <div className="bg-white/80 p-3 rounded-xl border border-slate-200/50 flex flex-wrap items-center justify-between gap-3 text-[10px]">
          <div className="flex gap-4">
            <div>
              <span className="text-slate-400 block uppercase font-bold text-[8px]">Closing Stock</span>
              <span className="font-extrabold text-slate-700">{Number((product.totalQty || 0).toFixed(2))} {product.units}</span>
            </div>
            <div>
              <span className="text-indigo-400 block uppercase font-bold text-[8px]">Pending PO Qty</span>
              <span className="font-extrabold text-indigo-700">{poQty} {product.units}</span>
            </div>
            <div 
              onClick={() => {
                if (soQty > 0) {
                  setShowPendingSalesPopup(true);
                }
              }}
              className={`select-none ${soQty > 0 ? "cursor-pointer hover:bg-rose-50 px-1.5 py-0.5 rounded transition" : ""}`}
            >
              <span className="text-rose-400 block uppercase font-bold text-[8px]">Pending SO Qty {soQty > 0 && "🖱️ Details"}</span>
              <span className="font-extrabold text-rose-700">{soQty} {product.units}</span>
            </div>
            <div>
              <span className="text-emerald-400 block uppercase font-bold text-[8px]">Net Available</span>
              <span className="font-extrabold text-emerald-700">{netAvailability} {product.units}</span>
            </div>
          </div>
        </div>

        {/* Resolved Preview & Action Buttons */}
        <div className="bg-slate-900 text-gray-200 p-3.5 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-inner">
          <div className="flex gap-5 items-center">
            <div className="text-[10px]">
              <span className="text-gray-400 block font-semibold">Active Mode</span>
              <span className="font-bold text-indigo-400">
                {reorderQtyMode === "HIGH" && thresholdMode === "HIGH"
                  ? "🚀 BOTH HIGH"
                  : reorderQtyMode === "LOW" && thresholdMode === "LOW"
                  ? "🛠️ BOTH LOW"
                  : `🚀 Qty: ${reorderQtyMode}, Thresh: ${thresholdMode}`}
              </span>
            </div>
            <div className="text-[10px]">
              <span className="text-gray-400 block font-semibold text-red-300">Trigger Threshold</span>
              <span className="font-bold text-red-400">{resolvedThreshold} {product.units}</span>
            </div>
            <div className="text-[10px]">
              <span className="text-gray-400 block font-semibold text-green-300">Order Quantity</span>
              <span className="font-bold text-green-400">{resolvedQty} {product.units}</span>
            </div>
            {netAvailability < resolvedThreshold && (
              <div className="text-[10px] bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded">
                <span className="text-amber-300 block font-bold">💡 Suggest Restock</span>
                <span className="font-bold text-amber-400">{resolvedQty - netAvailability} {product.units}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              type="button"
              onClick={() => {
                setRestockingConfigMode(false);
                setRestockingEditingProduct(null);
              }}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveRestockingConfig}
              disabled={savingRestockingConfig}
              className="px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-700 text-white font-bold transition disabled:opacity-50 cursor-pointer"
            >
              {savingRestockingConfig ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Trigger full page alert if low stock levels are reached
  useEffect(() => {
    if (products.length > 0 && !alertDismissed) {
      const criticalProducts = products.filter((p) => {
        const { reorderLevel } = getReorderParams(p);
        // Trigger alert if current stock hits or drops below reorder level (threshold)
        return p.totalQty <= reorderLevel;
      });
      if (criticalProducts.length > 0) {
        setAlertProducts(criticalProducts);
        setShowFullPageAlert(true);
      }
    }
  }, [products, alertDismissed]);

  // Full Page Stock Alarm/Alert Overlay
  const FullPageStockAlert = () => {
    if (!showFullPageAlert || alertProducts.length === 0) return null;

    return (
      <div className="fixed inset-0 bg-red-950/90 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
        <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col border-4 border-red-500 transform scale-100 transition-all duration-300">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-red-600 via-red-700 to-rose-600 text-white p-8 text-center relative overflow-hidden">
            {/* Pulsing light behind icon */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.15),transparent)] animate-pulse" />
            <div className="relative z-10 flex flex-col items-center">
              <div className="p-4 bg-white/20 rounded-full text-5xl mb-3 animate-bounce">
                🚨
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight uppercase">
                CRITICAL STOCK REORDER LEVEL REACHED!
              </h2>
              <p className="text-red-100 text-sm md:text-base mt-2 max-w-2xl font-medium">
                The closing quantities of the following products have reached or dropped below their safety threshold. Immediate action is required to avoid stockouts.
              </p>
            </div>
          </div>

          {/* List of critical products */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-4">
            <div className="flex justify-between items-center text-xs font-bold text-gray-400 uppercase tracking-wider border-b pb-2">
              <span>Product Details</span>
              <div className="flex gap-8">
                <span className="w-24 text-right">System Qty</span>
                <span className="w-24 text-right text-red-500">Threshold</span>
                <span className="w-24 text-right text-green-600">Reorder Qty</span>
              </div>
            </div>

            {alertProducts.map((p) => {
              const { reorderQty, reorderLevel } = getReorderParams(p);
              return (
                <div key={p._id} className="flex justify-between items-center py-4 border-b border-gray-100 hover:bg-red-50/30 px-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📦</span>
                    <div>
                      <h4 className="font-extrabold text-gray-800 text-sm md:text-base">{p.name}</h4>
                      <p className="text-xs text-gray-500">Preferred Vendor: <span className="font-semibold text-gray-700">{p.preferredVendor || "-"}</span></p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-bold text-gray-900 leading-none">
                      {Number((p.totalQty || 0).toFixed(2))} <span className="text-[10px] text-gray-500 font-normal">{p.units}</span>
                    </div>
                    <span className="w-24 text-right text-red-600 font-extrabold">
                      {reorderLevel} <span className="text-[10px] text-red-500 font-normal">{p.units}</span>
                    </span>
                    <span className="w-24 text-right text-green-600 font-extrabold">
                      {reorderQty} <span className="text-[10px] text-green-600 font-normal">{p.units}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer actions */}
          <div className="bg-gray-50 px-6 py-6 md:px-8 border-t border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between">
            <button
              onClick={() => {
                setShowFullPageAlert(false);
                setAlertDismissed(true);
              }}
              className="w-full md:w-auto px-6 py-3 border-2 border-gray-300 text-gray-600 font-bold hover:bg-gray-100 transition rounded-xl flex items-center justify-center gap-2"
            >
              <span>🔓</span> Dismiss and View Page
            </button>
            
            <button
              onClick={async () => {
                // Select all low stock products for bulk restocking
                const newSelected = new Set();
                alertProducts.forEach(p => newSelected.add(p._id));
                setSelectedProducts(newSelected);
                
                setShowFullPageAlert(false);
                setAlertDismissed(true);
                
                toast.success(`✅ Selected all ${alertProducts.length} low stock products for restocking!`);
              }}
              className="w-full md:w-auto px-8 py-3.5 bg-gradient-to-r from-red-600 to-rose-600 text-white font-extrabold hover:from-red-700 hover:to-rose-700 transition rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-red-600/35 transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>🛒</span> Select and Restock All ({alertProducts.length})
            </button>
          </div>

        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20 px-4 md:px-6 pb-10">
      <FullPageStockAlert />

      <div className="w-full">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-900 text-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <FaExclamationTriangle className="text-5xl opacity-80" />
              <div>
                <h1 className="text-4xl font-bold">Smart Restocking</h1>
                <p className="text-blue-100 mt-1">Automated Low Stock Alerts & Restocking</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {(user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" || user?.actionPermissions?.export !== false) && (
                <button
                  onClick={handleExportExcel}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition flex items-center gap-2 shadow-sm cursor-pointer hover:scale-105 transform active:scale-95 duration-150"
                  title="Export current restocking records to Excel"
                >
                  <FaFileExport /> Export Excel
                </button>
              )}
              <button
                onClick={() => fetchAllData(currentPage, searchTerm)}
                disabled={loading}
                className="bg-white text-blue-900 px-4 py-2 rounded-lg font-semibold hover:bg-slate-50 transition disabled:opacity-50 flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <FaSync className={loading ? "animate-spin" : ""} />
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>
          </div>

          {/* Search and Bulk Restock Bar */}
          <div className="flex gap-3 flex-wrap items-center">
            <div className="flex-1 min-w-64">
              <input
                type="text"
                placeholder="🔍 Search products by name..."
                value={searchTerm}
                onChange={handleSearch}
                className="w-full px-4 py-2 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Product Group Filter */}
            <select
              value={selectedProductGroup}
              onChange={(e) => {
                setSelectedProductGroup(e.target.value);
                setSelectedProducts(new Set()); // Clear selection when changing group
                setCurrentPage(1); // Reset to first page
              }}
              className="px-4 py-2 rounded-lg text-gray-800 bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
            >
              {allProductGroups.map((group) => (
                <option key={String(group)} value={String(group)}>
                  {String(group)} {allProducts.length > 0 ? (group !== "All" ? `(${allProducts.filter((p) => {
                    const groupName = p.productGroup && typeof p.productGroup === 'object' 
                      ? (p.productGroup.name || p.productGroup._id)
                      : p.productGroup;
                    return groupName === group;
                  }).length})` : `(${allProducts.length})`) : ""}
                </option>
              ))}
            </select>

            {/* View Toggle */}
            <div className="flex gap-2 bg-white/20 p-1 rounded-lg">
              <button
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition font-medium ${
                  viewMode === "table"
                    ? "bg-white text-blue-900 shadow-md"
                    : "text-white hover:bg-white/10"
                }`}
              >
                <FaList size={16} /> Table
              </button>
              <button
                onClick={() => setViewMode("card")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition font-medium ${
                  viewMode === "card"
                    ? "bg-white text-blue-900 shadow-md"
                    : "text-white hover:bg-white/10"
                }`}
              >
                <FaThLarge size={16} /> Card
              </button>
            </div>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between mt-4 px-4 py-3 bg-white rounded-lg shadow-sm overflow-x-auto">
            <div className="text-sm text-gray-600 flex items-center gap-4 whitespace-nowrap">
              <div>
                <span className="font-semibold">Page {allProducts.length > 0 ? (totalFilteredPages > 0 ? currentPage : 0) : (pagination.pages > 0 ? currentPage : 0)} of {allProducts.length > 0 ? totalFilteredPages : (pagination.pages || 0)}</span>
                <span className="ml-3">Total: <strong>{allProducts.length > 0 ? filteredProducts.length : pagination.total}</strong> products</span>
              </div>
              <div className="flex items-center gap-2 border-l pl-4 border-gray-300">
                <label className="font-medium text-gray-700">Per page:</label>
                <select 
                  value={itemsPerPage} 
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="border border-gray-300 rounded px-2 py-1 text-sm bg-white cursor-pointer focus:ring-2 focus:ring-orange-500 outline-none"
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={150}>150</option>
                  <option value={200}>200</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1 || loading}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              
              <div className="flex items-center gap-2 px-3">
                {Array.from({ length: Math.min(5, allProducts.length > 0 ? totalFilteredPages : pagination.pages) }).map((_, idx) => {
                  let pageNum;
                  const totalP = allProducts.length > 0 ? totalFilteredPages : pagination.pages;
                  if (totalP <= 5) {
                    pageNum = idx + 1;
                  } else if (currentPage <= 3) {
                    pageNum = idx + 1;
                  } else if (currentPage >= totalP - 2) {
                    pageNum = totalP - 4 + idx;
                  } else {
                    pageNum = currentPage - 2 + idx;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-1 rounded-lg font-semibold transition ${
                        currentPage === pageNum
                          ? "bg-blue-900 text-white"
                          : "border border-gray-300 text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage(Math.min(allProducts.length > 0 ? totalFilteredPages : pagination.pages, currentPage + 1))}
                disabled={currentPage === (allProducts.length > 0 ? totalFilteredPages : pagination.pages) || (allProducts.length > 0 ? totalFilteredPages : pagination.pages) === 0 || loading}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </div>
        </div>

        {/* BULK SETTINGS BAR FOR AUTO DAYS RECALCULATION */}
        {selectedProducts.size > 0 && (
          <div className="bg-slate-900 text-white rounded-2xl shadow-lg p-5 mb-6 flex flex-wrap items-center justify-between gap-4 border border-purple-500/30 animate-fadeIn font-sans text-left">
            <div className="flex items-center gap-3">
              <div className="bg-purple-600/25 p-2 rounded-xl text-purple-400 text-xl border border-purple-500/30">
                ⚙️
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-purple-100">Bulk Restocking Rules for {selectedProducts.size} Selected Product{selectedProducts.size !== 1 ? "s" : ""}</h3>
                <p className="text-[10px] text-slate-400 font-normal mt-0.5">Recalculate sales-based auto levels or create PO in bulk</p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-4">
              {/* Sales Period Days Input */}
              <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-1.5 shadow-inner">
                <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Auto Days:</span>
                <input
                  type="number"
                  placeholder="Days"
                  id="bulkSalesDaysInput"
                  defaultValue="7"
                  className="w-14 px-2 py-0.5 rounded bg-slate-950 text-white font-extrabold text-xs text-center focus:outline-none border border-slate-700"
                />
                <button
                  type="button"
                  onClick={() => {
                    const val = document.getElementById("bulkSalesDaysInput")?.value;
                    const days = parseInt(val);
                    if (isNaN(days) || days <= 0) {
                      toast.error("Please enter a valid number of days (> 0)");
                      return;
                    }
                    applyBulkSalesPeriod(days);
                  }}
                  disabled={savingBulkConfig}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-[10px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer disabled:opacity-50"
                >
                  {savingBulkConfig ? "Recalculating..." : "Apply & Save"}
                </button>
              </div>

              {actionPermissions.restock !== false && (
                <button
                  type="button"
                  onClick={handleBulkRestock}
                  disabled={bulkRestockingInProgress}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 shadow cursor-pointer"
                >
                  ✓ Create Bulk PO ({selectedProducts.size} Products)
                </button>
              )}
            </div>
          </div>
        )}

        {/* CONTENT */}
        {!branchLoaded ? (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <div className="animate-pulse text-gray-500">
              ⏳ Initializing branch context...
            </div>
          </div>
        ) : loading ? (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <div className="animate-pulse text-gray-500">
              Loading products...
            </div>
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <p className="text-gray-500">No products found for this branch</p>
          </div>
        ) : viewMode === "card" ? (
          /* CARD VIEW */
          <div className="bg-white rounded-2xl shadow p-8">
            {/* OUT OF STOCK */}
            <StockCategory
              title="🔴 OUT OF STOCK"
              products={filteredOutOfStock}
              icon={FaBox}
              bgColor="bg-red-50"
              textColor="text-red-600"
              borderColor="border-red-300"
            />

            {/* LOW STOCK */}
            <StockCategory
              title="🟡 LOW STOCK - ACTION REQUIRED"
              products={filteredLowStock}
              icon={FaExclamationCircle}
              bgColor="bg-yellow-50"
              textColor="text-yellow-700"
              borderColor="border-yellow-300"
            />

            {/* NORMAL STOCK */}
            <StockCategory
              title="🟢 NORMAL STOCK"
              products={filteredNormalStock}
              icon={FaBox}
              bgColor="bg-green-50"
              textColor="text-green-700"
              borderColor="border-green-300"
            />
          </div>
        ) : (
          /* TABLE VIEW */
          <div className="bg-white rounded-2xl shadow overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-2 py-2 text-left text-[11px] font-bold sticky left-0 z-20 bg-slate-50 border-r border-slate-200">
                    <input
                      type="checkbox"
                      checked={selectedProducts.size === paginatedProducts.length && paginatedProducts.length > 0}
                      onChange={() => {
                        if (selectedProducts.size === paginatedProducts.length) {
                          setSelectedProducts(new Set());
                        } else {
                          setSelectedProducts(new Set(paginatedProducts.map(p => p._id)));
                        }
                      }}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </th>
                  {isFieldAllowed("productName") && (
                    <th 
                      onClick={() => handleSort("name")}
                      className="px-2 py-2 text-left text-[11px] font-bold cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap sticky left-[36px] z-20 bg-slate-50 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]"
                    >
                      Product {sortConfig.key === "name" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "⇅"}
                    </th>
                  )}
                  {isFieldAllowed("units") && (
                    <th 
                      onClick={() => handleSort("units")}
                      className="px-1 py-2 text-left text-[11px] font-bold cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                    >
                      Unit {sortConfig.key === "units" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "⇅"}
                    </th>
                  )}
                  {isFieldAllowed("currentStock") && (
                    <th 
                      onClick={() => handleSort("totalQty")}
                      className="px-1 py-2 text-right text-[11px] font-bold cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                    >
                      Sys Qty {sortConfig.key === "totalQty" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "⇅"}
                    </th>
                  )}
                  {isFieldAllowed("currentStock") && (
                    <th 
                      onClick={() => handleSort("pendingPO")}
                      className="px-1 py-2 text-right text-[11px] font-bold cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                    >
                      PO Qty {sortConfig.key === "pendingPO" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "⇅"}
                    </th>
                  )}
                  <th 
                    onClick={() => handleSort("lastPurchaseDate")}
                    className="px-1 py-2 text-left text-[11px] font-bold cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                  >
                    Pur. Date {sortConfig.key === "lastPurchaseDate" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "⇅"}
                  </th>
                  <th 
                    onClick={() => handleSort("purchaseAge")}
                    className="px-1 py-2 text-left text-[11px] font-bold cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                  >
                    Pur. Age {sortConfig.key === "purchaseAge" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "⇅"}
                  </th>
                  <th 
                    onClick={() => handleSort("lastSalesDate")}
                    className="px-1 py-2 text-left text-[11px] font-bold cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap text-indigo-600"
                  >
                    Sal. Date {sortConfig.key === "lastSalesDate" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "⇅"}
                  </th>
                  <th 
                    onClick={() => handleSort("salesAge")}
                    className="px-1 py-2 text-left text-[11px] font-bold cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap text-indigo-600"
                  >
                    Sal. Age {sortConfig.key === "salesAge" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "⇅"}
                  </th>
                  {isFieldAllowed("pendingSales") && (
                    <th 
                      onClick={() => handleSort("pendingSales")}
                      className="px-1 py-2 text-right text-[11px] font-bold cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                    >
                      SO Qty {sortConfig.key === "pendingSales" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "⇅"}
                    </th>
                  )}
                  {isFieldAllowed("available") && (
                    <th 
                      onClick={() => handleSort("netAvailability")}
                      className="px-1 py-2 text-right text-[11px] font-bold cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                    >
                      Net Qty {sortConfig.key === "netAvailability" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "⇅"}
                    </th>
                  )}
                  {isFieldAllowed("threshold") && (
                    <th 
                      onClick={() => handleSort("threshold")}
                      className="px-1 py-2 text-right text-[11px] font-bold cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                    >
                      Min Lvl {sortConfig.key === "threshold" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "⇅"}
                    </th>
                  )}
                  {isFieldAllowed("restockQty") && (
                    <th 
                      onClick={() => handleSort("restockingQty")}
                      className="px-1 py-2 text-right text-[11px] font-bold cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                    >
                      Re. {sortConfig.key === "restockingQty" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "⇅"}
                    </th>
                  )}

                  {isFieldAllowed("status") && (
                    <th 
                      onClick={() => handleSort("status")}
                      className="px-2 py-2 text-center text-[11px] font-bold cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                    >
                      Status {sortConfig.key === "status" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "⇅"}
                    </th>
                  )}
                  {isFieldAllowed("action_config") && (
                    <th className="px-2 py-2 text-center text-[11px] font-bold">Cfg</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.map((product, index) => {
                  const { reorderQty, reorderLevel, isAuto } = getReorderParams(product);
                  
                  const stockStatus = 
                    product.totalQty === 0 ? "🔴 Out of Stock" :
                    product.totalQty <= reorderLevel ? "🟡 Low Stock" :
                    "🟢 Normal";
                  
                  const poQty = pendingPOMap?.[product._id] || 0;
                  const soQty = pendingSalesMap?.[product._id] || 0;
                  const netAvailability = Number(((product.totalQty || 0) + poQty - soQty).toFixed(2));
                  const isEditingThisProduct = restockingConfigMode && restockingEditingProduct?._id === product._id;
                  
                  return (
                    <Fragment key={product._id}>
                      <tr
                        className={`${
                          isEditingThisProduct
                            ? "bg-purple-50/40 border-l-4 border-l-purple-500 font-medium"
                            : index % 2 === 0
                            ? "bg-white"
                            : "bg-gray-50"
                        } border-b border-gray-200 hover:bg-orange-50/30 transition`}
                      >
                        <td className="px-2 py-2 sticky left-0 z-10 bg-inherit border-b border-gray-100 border-r">
                          <input
                             type="checkbox"
                             checked={selectedProducts.has(product._id)}
                             onChange={() => toggleProductSelection(product._id)}
                             className="w-4 h-4 cursor-pointer"
                          />
                        </td>
                        {isFieldAllowed("productName") && (
                          <td className="px-2 py-2 font-semibold text-gray-800 text-[11px] whitespace-normal min-w-[200px] sticky left-[36px] z-10 bg-inherit border-b border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]" title={product.name}>
                            {product.name}
                          </td>
                        )}
                        {isFieldAllowed("units") && (
                          <td className="px-1 py-2 text-gray-600 text-[10px] whitespace-nowrap">
                            {product.units}
                          </td>
                        )}
                        {isFieldAllowed("currentStock") && (
                          <td className="px-1 py-2 text-right font-bold text-gray-800 text-[11px]">
                            {Number((product.totalQty || 0).toFixed(2))}
                          </td>
                        )}
                        {isFieldAllowed("currentStock") && (
                          <td className="px-1 py-2 text-right text-[11px]">
                            {poQty > 0 ? (
                              <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-bold">
                                {poQty}
                              </span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                        )}
                        {/* Last Purchase Date */}
                        <td className="px-1 py-2 text-left text-[11px] text-gray-600 whitespace-nowrap">
                          {getPurchaseDateString(product.lastPurchaseDate)}
                        </td>
                        {/* Purchase Age (Days) */}
                        <td className="px-1 py-2 text-left text-[11px] text-gray-600 whitespace-nowrap">
                          {getPurchaseAgeString(product.lastPurchaseDate)}
                        </td>
                        {/* Last Sales Date */}
                        <td className="px-1 py-2 text-left text-[11px] text-indigo-600 font-medium whitespace-nowrap">
                          {getPurchaseDateString(product.lastSalesDate)}
                        </td>
                        {/* Sales Age (Days) */}
                        <td className="px-1 py-2 text-left text-[11px] text-indigo-600 font-medium whitespace-nowrap">
                          {getPurchaseAgeString(product.lastSalesDate)}
                        </td>
                        {isFieldAllowed("pendingSales") && (
                          <td className="px-1 py-2 text-right text-[11px]">
                            {soQty > 0 ? (
                              <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-bold">
                                {soQty}
                              </span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                        )}
                        {isFieldAllowed("available") && (
                          <td className="px-1 py-2 text-right text-[11px]">
                            <span className={`px-1.5 py-0.5 rounded font-extrabold ${
                              netAvailability <= reorderLevel
                                ? "bg-red-50 text-red-700 border border-red-200"
                                : "text-gray-800"
                            }`}>
                              {netAvailability}
                            </span>
                          </td>
                        )}
                        {isFieldAllowed("threshold") && (
                          <td className="px-1 py-2 text-right text-gray-800 text-[11px] font-bold">
                            {reorderLevel}
                          </td>
                        )}
                        {isFieldAllowed("restockQty") && (
                          <td className="px-1 py-2 text-right text-[11px] font-semibold whitespace-nowrap">
                            <div className="flex flex-col items-end">
                              <span className="text-gray-800 font-extrabold">{reorderQty}</span>
                              <span className={`text-[9px] px-1 rounded font-bold mt-0.5 leading-tight ${
                                isAuto ? "bg-purple-50 text-purple-600" : "bg-teal-50 text-teal-600"
                              }`}>
                                {isAuto ? "AUTO" : "MANUAL"}
                              </span>
                            </div>
                          </td>
                        )}
  
                        {isFieldAllowed("status") && (
                          <td className="px-2 py-2 text-[11px] text-center whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              product.totalQty === 0
                                ? "bg-red-50 text-red-700"
                                : product.totalQty <= reorderLevel
                                ? "bg-yellow-50 text-yellow-700"
                                : "bg-green-50 text-green-700"
                            }`}>
                              {stockStatus}
                            </span>
                            {netAvailability < reorderLevel && (
                              <span className="text-[9px] text-amber-700 bg-amber-50 border border-amber-200/50 px-1 py-0.5 rounded font-black block mt-1 text-center whitespace-nowrap">
                                💡 Restock {reorderQty - netAvailability} {product.units}
                              </span>
                            )}
                          </td>
                        )}
                        {(isFieldAllowed("action_config") || isFieldAllowed("action_restock")) && (
                          <td className="px-2 py-2 text-center whitespace-nowrap">
                            {isFieldAllowed("action_config") && (
                              <button
                                onClick={() => openRestockingConfigModal(product)}
                                className={`p-1 transition text-sm rounded ${
                                  isEditingThisProduct
                                    ? "text-purple-600 bg-purple-100/80 hover:bg-purple-200/80 px-1.5"
                                    : "text-gray-400 hover:text-purple-600 hover:bg-gray-100"
                                }`}
                                title="Configure Restocking"
                              >
                                {isEditingThisProduct ? "✕ Close" : "⚙️"}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                      {isEditingThisProduct && (
                        <tr key={`${product._id}-config`} className="bg-purple-50/20">
                          <td colSpan={100} className="px-4 py-2 border-b border-purple-200/50">
                            {renderInlineConfig(product)}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EDIT MODAL */}
      {editingProduct && EditModal()}



      {/* BULK RESTOCK PREVIEW MODAL */}
      {bulkRestockPreviewMode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-900 text-white p-6 rounded-t-xl sticky top-0">
              <h2 className="text-2xl font-bold font-sans">🛒 Grouped Restocking Preview</h2>
              <p className="text-blue-100 mt-1 text-sm">Review and edit quantities before creating PO</p>
            </div>

            <div className="p-6 space-y-4">
              {/* Vendor Info */}
              <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                <p className="text-sm text-gray-600">
                  <strong>Vendor:</strong> {bulkRestockPreviewItems[0]?.preferredVendor || "Default Vendor"}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Items:</strong> {bulkRestockPreviewItems.length} products
                </p>
              </div>

              {/* Products Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left text-sm font-bold text-gray-700">Product Name</th>
                      <th className="px-3 py-2 text-center text-sm font-bold text-gray-700">Unit</th>
                      <th className="px-3 py-2 text-right text-sm font-bold text-gray-700">Price</th>
                      <th className="px-3 py-2 text-center text-sm font-bold text-gray-700">🛒 Qty</th>
                      <th className="px-3 py-2 text-right text-sm font-bold text-gray-700">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkRestockPreviewItems.map((product, idx) => {
                      const qty = bulkRestockEditQty[product._id] !== undefined ? bulkRestockEditQty[product._id] : getReorderParams(product).reorderQty;
                      const subtotal = qty * product.purchasingPrice;

                      return (
                        <tr key={product._id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="px-3 py-3 text-sm font-semibold text-gray-800 border-b">
                            {product.name}
                          </td>
                          <td className="px-3 py-3 text-sm text-center text-gray-600 border-b">
                            {product.units}
                          </td>
                          <td className="px-3 py-3 text-sm text-right text-gray-800 font-semibold border-b">
                            ₹{product.purchasingPrice}
                          </td>
                          <td className="px-3 py-3 text-center border-b">
                            <input
                              type="number"
                              value={qty}
                              onChange={(e) =>
                                setBulkRestockEditQty((prev) => ({
                                  ...prev,
                                  [product._id]: parseInt(e.target.value) || 0,
                                }))
                              }
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-center font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-3 py-3 text-sm text-right text-gray-800 font-bold border-b">
                            ₹{subtotal.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50/70 p-4 rounded-lg border border-blue-200 shadow-sm">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-gray-600 font-medium">Subtotal</p>
                    <p className="text-lg font-extrabold text-blue-900">
                      ₹
                      {bulkRestockPreviewItems
                        .reduce(
                          (sum, p) => {
                            const qty = bulkRestockEditQty[p._id] !== undefined ? bulkRestockEditQty[p._id] : getReorderParams(p).reorderQty;
                            return sum + qty * p.purchasingPrice;
                          },
                          0
                        )
                        .toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-medium">Tax (GST)</p>
                    <p className="text-lg font-extrabold text-blue-900">
                      ₹
                      {bulkRestockPreviewItems
                        .reduce(
                          (sum, p) => {
                            const qty = bulkRestockEditQty[p._id] !== undefined ? bulkRestockEditQty[p._id] : getReorderParams(p).reorderQty;
                            return sum + (qty * p.purchasingPrice * (p.gst || 0)) / 100;
                          },
                          0
                        )
                        .toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-medium">Grand Total</p>
                    <p className="text-lg font-extrabold text-blue-900">
                      ₹
                      {bulkRestockPreviewItems
                        .reduce(
                          (sum, p) => {
                            const qty = bulkRestockEditQty[p._id] !== undefined ? bulkRestockEditQty[p._id] : getReorderParams(p).reorderQty;
                            const itemSubtotal = qty * p.purchasingPrice;
                            const itemTax = (itemSubtotal * (p.gst || 0)) / 100;
                            return sum + itemSubtotal + itemTax;
                          },
                          0
                        )
                        .toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="bg-gray-50 px-6 py-4 rounded-b-xl flex gap-3 border-t sticky bottom-0">
              <button
                onClick={() => {
                  setBulkRestockPreviewMode(false);
                  setBulkRestockPreviewItems([]);
                  setBulkRestockEditQty({});
                }}
                className="flex-1 px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-100 transition"
              >
                ✕ Cancel
              </button>
              <button
                onClick={confirmBulkRestock}
                disabled={bulkRestockingInProgress}
                className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-blue-900 to-indigo-900 hover:from-blue-950 hover:to-indigo-950 text-white font-semibold transition disabled:opacity-50 shadow-sm"
              >
                {bulkRestockingInProgress ? "⏳ Creating PO..." : "✅ Create PO"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Pending SO Dialog */}
      {showPendingSalesPopup && restockingEditingProduct && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-gray-100 transform scale-100 transition-all duration-300">
            <div className="bg-gradient-to-r from-rose-600 via-pink-600 to-rose-700 text-white p-5 rounded-t-3xl shadow-md flex justify-between items-center text-left">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">🛒</span>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">Pending Sales Orders</h3>
                  <p className="text-rose-100 text-xs font-semibold">{restockingEditingProduct.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowPendingSalesPopup(false)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white font-bold flex items-center justify-center transition active:scale-90"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 max-h-[50vh] overflow-y-auto text-left">
              {(() => {
                const details = pendingSalesDetailsMap[restockingEditingProduct._id] || [];
                if (details.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <span className="text-4xl block mb-2">🎉</span>
                      <p className="text-xs text-gray-500 font-bold">No pending sales orders found for this product.</p>
                    </div>
                  );
                }
                
                return (
                  <div className="space-y-3">
                    <div className="text-[10px] text-gray-500 font-black uppercase tracking-wider mb-2">
                      Total Orders: {details.length}
                    </div>
                    <div className="divide-y divide-gray-100">
                      {details.map((d, index) => (
                        <div key={index} className="py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors px-2 rounded-xl">
                          <div className="space-y-0.5">
                            <span className="text-xs font-black text-rose-600 uppercase block">{d.invoiceId}</span>
                            <span className="text-[11px] font-bold text-gray-700 block">{d.customerName}</span>
                            <span className="text-[9px] text-gray-400 block font-semibold">
                              Date: {new Date(d.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-black text-gray-800 block">
                              {d.qty} <span className="text-xs text-gray-500 font-medium">{restockingEditingProduct.units}</span>
                            </span>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full inline-block mt-1 ${
                              d.daysPending > 7 ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-amber-100 text-amber-700'
                            }`}>
                              ⏳ {d.daysPending} day{d.daysPending !== 1 ? 's' : ''} pending
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
            
            <div className="bg-gray-50 px-6 py-4 rounded-b-3xl flex justify-end border-t border-gray-100">
              <button
                onClick={() => setShowPendingSalesPopup(false)}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition shadow-md active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
