import { useEffect, useState } from "react";
import { FaArrowUp, FaBox, FaEdit, FaExclamationCircle, FaExclamationTriangle, FaList, FaSync, FaThLarge } from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";
import { API_BASE } from "../../api";
import { useBranch } from "../../context/BranchContext";

export default function BranchRecycling() {
  const { currentBranch, user } = useBranch();
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
  const [pagination, setPagination] = useState({ total: 0, pages: 0, limit: 50 });
  const [viewMode, setViewMode] = useState("card"); // "card" or "table"
  const [selectedProductGroup, setSelectedProductGroup] = useState("All"); // Filter by group
  const [allProducts, setAllProducts] = useState([]); // Store all products for group filtering
  const [allProductGroups, setAllProductGroups] = useState([]); // Store all unique product groups

  // Restocking Configuration Modal State
  const [restockingConfigMode, setRestockingConfigMode] = useState(false);
  const [restockingEditingProduct, setRestockingEditingProduct] = useState(null);
  const [restockingFormValues, setRestockingFormValues] = useState({
    salesPeriodDays: 7,
    sellingQtyInPeriod: 0,
    threshold: null,
    restockingQty: null,
  });
  const [calculatingSellingQty, setCalculatingSellingQty] = useState(false);
  const [savingRestockingConfig, setSavingRestockingConfig] = useState(false);

  // Bulk Restock Preview Modal State
  const [bulkRestockPreviewMode, setBulkRestockPreviewMode] = useState(false);
  const [bulkRestockPreviewItems, setBulkRestockPreviewItems] = useState([]);
  const [bulkRestockEditQty, setBulkRestockEditQty] = useState({});

  // Fetch all products to get all product groups available
  const fetchAllProductsForGroups = async () => {
    if (!currentBranch?._id) return;

    try {
      const branchId = currentBranch._id;
      let allProductsData = [];
      let page = 1;
      let hasMore = true;

      console.log("🔄 Starting to fetch all products for groups...");

      // Fetch all pages until we get all products
      while (hasMore) {
        const url = `${API_BASE}/products?branchId=${branchId}&page=${page}&limit=500`; // Increased limit
        
        console.log(`📄 Fetching page ${page} from: ${url}`);
        
        const res = await fetch(url);
        if (!res.ok) {
          console.warn(`⚠️ API returned status ${res.status}, stopping fetch`);
          break;
        }
        
        const data = await res.json();
        console.log(`📦 Page ${page} response:`, data);
        
        let productList = [];
        let pagination = null;

        if (data?.data && Array.isArray(data.data)) {
          productList = data.data;
          pagination = data.pagination;
          console.log(`✨ Extracted ${productList.length} products from data.data`);
        } else if (Array.isArray(data)) {
          productList = data;
          console.log(`✨ Response is direct array with ${productList.length} products`);
          hasMore = false;
        } else if (data?.products && Array.isArray(data.products)) {
          productList = data.products;
          pagination = data.pagination;
          console.log(`✨ Extracted ${productList.length} products from data.products`);
        } else {
          console.warn("⚠️ No products array found in response");
          hasMore = false;
        }

        if (productList.length === 0) {
          console.log("📭 Empty product list, stopping fetch");
          hasMore = false;
        } else {
          allProductsData = [...allProductsData, ...productList];
          console.log(`📊 Total products so far: ${allProductsData.length}`);

          // Check if there are more pages
          if (pagination) {
            console.log(`📄 Pagination info:`, pagination);
            if (page >= (pagination.pages || 1)) {
              hasMore = false;
            }
          } else {
            hasMore = false;
          }
        }

        page++;

        // Safety limit to prevent infinite loops
        if (page > 100) {
          console.warn("⚠️ Reached max pages (100), stopping");
          hasMore = false;
        }
      }

      console.log(`✅ FINAL: Fetched ${allProductsData.length} total products`);
      console.log("📋 All products:", allProductsData);

      // Store all products and extract unique groups
      setAllProducts(allProductsData);

      // Extract unique product groups
      const groups = new Set(
        allProductsData
          .map((p) => {
            if (p.productGroup && typeof p.productGroup === 'object') {
              return p.productGroup.name || p.productGroup._id;
            }
            return p.productGroup;
          })
          .filter(Boolean)
      );
      
      const finalGroups = ["All", ...Array.from(groups).sort()];
      console.log("🏷️ Unique product groups:", finalGroups);
      setAllProductGroups(finalGroups);
    } catch (err) {
      console.error("❌ Error fetching all product groups:", err);
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
      let url = `${API_BASE}/products?branchId=${branchId}&page=${page}&limit=50`;
      
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
      const res = await fetch(`${API_BASE}/sales-orders?branchId=${currentBranch._id}`);
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
      pendingOrders.forEach((order) => {
        if (Array.isArray(order.items)) {
          order.items.forEach((item) => {
            const prodId = item.productId?._id || item.productId;
            pendingMap[prodId] = (pendingMap[prodId] || 0) + (item.qty || 0);
          });
        }
      });

      console.log("📊 Pending Sales Map:", pendingMap);
      return pendingMap;
    } catch (err) {
      console.error("❌ Error fetching pending sales:", err);
      return null;
    }
  };

  const [pendingSalesMap, setPendingSalesMap] = useState(null);

  // Fetch both products and pending sales
  const fetchAllData = async (page = 1, search = "") => {
    await fetchProducts(page, search);
    const pendingMap = await fetchPendingSales();
    setPendingSalesMap(pendingMap || {});
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
      fetchAllProductsForGroups(); // Fetch all groups on load
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
          const threshold = p.restockingConfig?.threshold ?? p.reorderLevel ?? 10;
          return p.totalQty > 0 && p.totalQty < threshold;
        }
      ),
      normalStock: prods.filter(
        (p) => {
          const threshold = p.restockingConfig?.threshold ?? p.reorderLevel ?? 10;
          return p.totalQty >= threshold && p.totalQty > 0;
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

  // Handle restocking
  const handleRestock = async (product) => {
    const restockQty = product.restockingConfig?.restockingQty ?? product.reorderQty;
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
    setRestockingEditingProduct(product);
    setRestockingConfigMode(true);
    setRestockingFormValues({
      salesPeriodDays: product.restockingConfig?.salesPeriodDays || 7,
      sellingQtyInPeriod: product.restockingConfig?.sellingQtyInPeriod || 0,
      threshold: product.restockingConfig?.threshold,
      restockingQty: product.restockingConfig?.restockingQty,
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
        
        // Update form values with calculated qty + auto-filled threshold & restock qty
        const updatedFormValues = {
          salesPeriodDays: days,
          sellingQtyInPeriod: calculatedQty,
          threshold: calculatedQty,
          restockingQty: calculatedQty,
        };
        
        setRestockingFormValues(updatedFormValues);
        
        // ✅ AUTOMATICALLY SAVE TO DATABASE - ONE STEP PROCESS
        setSavingRestockingConfig(true);
        const saveRes = await fetch(
          `${API_BASE}/products/${productId}/restocking-config`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedFormValues),
          }
        );

        const saveData = await saveRes.json();
        if (saveData.success || saveRes.ok) {
          // Update local product state to reflect changes immediately
          setProducts((prevProducts) =>
            prevProducts.map((p) =>
              p._id === productId
                ? { ...p, restockingConfig: saveData.restockingConfig || updatedFormValues }
                : p
            )
          );
          
          toast.success(`✅ ${calculatedQty} units calculated & auto-saved for last ${days} days!`);
          
          // Close modal and refresh
          setTimeout(() => {
            setRestockingConfigMode(false);
            setRestockingEditingProduct(null);
          }, 500);
        } else {
          toast.warning(`⚠️ Calculated: ${calculatedQty} qty but save failed, try again`);
        }
      } else {
        toast.error(data.message || "Failed to calculate selling qty");
      }
    } catch (err) {
      console.error("Error calculating selling qty:", err);
      toast.error("Error calculating selling quantity");
    } finally {
      setCalculatingSellingQty(false);
      setSavingRestockingConfig(false);
    }
  };

  // Auto-save threshold or order qty instantly when edited
  const autoSaveThresholdOrQty = async (updatedFormValues) => {
    if (!restockingEditingProduct) return;

    console.log("🔥 AUTOSAVE TRIGGERED!", updatedFormValues);
    toast.info("💾 Auto-saving threshold/qty...");

    try {
      console.log("📤 Sending to backend:", {
        productId: restockingEditingProduct._id,
        data: updatedFormValues
      });

      const res = await fetch(
        `${API_BASE}/products/${restockingEditingProduct._id}/restocking-config`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedFormValues),
        }
      );

      const data = await res.json();
      console.log("📥 Backend response:", data);
      
      if (data.success || res.ok) {
        // Update local product state silently (no toast to avoid spam)
        setProducts((prevProducts) =>
          prevProducts.map((p) =>
            p._id === restockingEditingProduct._id
              ? { ...p, restockingConfig: data.restockingConfig || updatedFormValues }
              : p
          )
        );
        console.log("✅ Threshold/Qty auto-saved instantly");
        toast.success("✅ Saved!");
      } else {
        console.error("❌ Save failed:", data.message);
        toast.error("❌ Failed to save");
      }
    } catch (err) {
      console.error("Error auto-saving threshold/qty:", err);
      toast.error("❌ Error saving!");
    }
  };

  // Save restocking configuration
  const saveRestockingConfig = async () => {
    if (!restockingEditingProduct) return;

    setSavingRestockingConfig(true);
    try {
      const res = await fetch(
        `${API_BASE}/products/${restockingEditingProduct._id}/restocking-config`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(restockingFormValues),
        }
      );

      const data = await res.json();
      if (data.success || res.ok) {
        // Update local product state
        setProducts((prevProducts) =>
          prevProducts.map((p) =>
            p._id === restockingEditingProduct._id
              ? { ...p, restockingConfig: data.restockingConfig || restockingFormValues }
              : p
          )
        );

        toast.success("✅ Restocking configuration updated!");
        setRestockingConfigMode(false);
        setRestockingEditingProduct(null);
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

    // Initialize preview with editable qty from CALCULATED SELLING QTY
    const previewItems = selectedProds.map((p) => ({
      ...p,
      previewQty: p.restockingConfig?.sellingQtyInPeriod ?? p.reorderQty ?? 20,
    }));

    setBulkRestockPreviewItems(previewItems);
    
    // Initialize edit qty state with calculated selling qty
    const qtyMap = {};
    previewItems.forEach((item) => {
      qtyMap[item._id] = item.restockingConfig?.sellingQtyInPeriod ?? item.reorderQty ?? 20;
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

      const items = bulkRestockPreviewItems.map((product) => {
        const qty = bulkRestockEditQty[product._id] || product.restockingConfig?.sellingQtyInPeriod || product.reorderQty || 20;
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

  // API already filters by search term, so just categorize the products
  const { outOfStock, lowStock, normalStock } = categorizeProducts(products);

  // Use allProducts when filtering by group, otherwise use paginated products
  const productsForFiltering = selectedProductGroup !== "All" ? allProducts : products;

  // Filter products by selected group (handle both string and object cases)
  const filteredProducts = selectedProductGroup === "All" 
    ? products 
    : productsForFiltering.filter((p) => {
        const groupName = p.productGroup && typeof p.productGroup === 'object' 
          ? (p.productGroup.name || p.productGroup._id)
          : p.productGroup;
        return groupName === selectedProductGroup;
      });

  const { outOfStock: filteredOutOfStock, lowStock: filteredLowStock, normalStock: filteredNormalStock } = categorizeProducts(filteredProducts);

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
          {prods.map((product) => (
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
                <div className="flex justify-between">
                  <span className="text-gray-600">Current Stock:</span>
                  <span className="font-semibold text-gray-800">
                    {product.totalQty} {product.units}
                  </span>
                </div>

                {/* Pending Sales (Not Invoiced) */}
                {pendingSalesMap && pendingSalesMap[product._id] > 0 && (
                  <div className="flex justify-between bg-yellow-50 p-2 rounded border-l-2 border-yellow-400">
                    <span className="text-yellow-700 font-medium">⏳ Pending Sales:</span>
                    <span className="font-semibold text-yellow-800">
                      {pendingSalesMap[product._id]} {product.units}
                    </span>
                  </div>
                )}

                {/* Available Qty */}
                {pendingSalesMap && pendingSalesMap[product._id] > 0 && (
                  <div className="flex justify-between bg-blue-50 p-2 rounded border-l-2 border-blue-400">
                    <span className="text-blue-700 font-medium">✓ Available:</span>
                    <span className="font-semibold text-blue-800">
                      {Math.max(0, product.totalQty - (pendingSalesMap[product._id] || 0))} {product.units}
                    </span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-gray-600">Threshold:</span>
                  <span className="font-semibold text-gray-800">
                    {product.restockingConfig?.threshold ?? product.reorderLevel ?? 10}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Restock Qty:</span>
                  <span className="font-semibold text-gray-800">
                    {product.restockingConfig?.restockingQty ?? product.reorderQty ?? 20}
                  </span>
                </div>
                {product.preferredVendor && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Vendor:</span>
                    <span className="font-semibold text-gray-800">
                      {product.preferredVendor}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => openRestockingConfigModal(product)}
                  className="w-full py-2 px-3 rounded font-semibold text-sm transition border-2 border-purple-500 text-purple-600 hover:bg-purple-50 flex items-center justify-center gap-2"
                >
                  <FaEdit /> Edit Settings
                </button>
                <button
                  onClick={() => handleRestock(product)}
                  disabled={
                    restockingInProgress[product._id] || 
                    !(product.restockingConfig?.restockingQty ?? product.reorderQty)
                  }
                  className={`w-full py-2 px-3 rounded font-semibold text-sm transition flex items-center justify-center gap-2 ${
                    restockingInProgress[product._id]
                      ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                      : (product.restockingConfig?.restockingQty ?? product.reorderQty)
                      ? "bg-green-500 text-white hover:bg-green-600"
                      : "bg-gray-300 text-gray-600 cursor-not-allowed"
                  }`}
                >
                  <FaArrowUp />
                  {restockingInProgress[product._id]
                    ? "Processing..."
                    : "Restock Now"}
                </button>
              </div>
            </div>
          ))}
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
                  setEditValues({ ...editValues, reorderLevel: parseInt(e.target.value) || 0 })
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
                  setEditValues({ ...editValues, reorderQty: parseInt(e.target.value) || 0 })
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
                <strong>Current Stock:</strong> {product.totalQty} {product.units}
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

  // Restocking Configuration Modal
  const RestockingConfigModal = () => {
    if (!restockingEditingProduct) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 rounded-t-xl sticky top-0">
            <h2 className="text-2xl font-bold">📊 Smart Restocking Configuration</h2>
            <p className="text-purple-100 mt-1">{restockingEditingProduct.name}</p>
          </div>

          <div className="p-6 space-y-6">
            {/* Step 1: Sales Period Input & Calculate */}
            <div className="border-b pb-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                📅 Step 1: Analyze Sales Period
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Number of Days
                  </label>
                  <input
                    type="number"
                    value={restockingFormValues.salesPeriodDays}
                    onChange={(e) =>
                      setRestockingFormValues((prev) => ({
                        ...prev,
                        salesPeriodDays: parseInt(e.target.value) || 7,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g., 7"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Analyze past X days of sales
                  </p>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={calculateSellingQty}
                    disabled={calculatingSellingQty || !restockingFormValues.salesPeriodDays}
                    className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold hover:from-orange-600 hover:to-orange-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {calculatingSellingQty ? "🔄 Calculating & Saving..." : "🔍 Calculate & Save"}
                  </button>
                </div>
              </div>
            </div>

            {/* Step 2: Display Calculated Qty */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-5 rounded-lg border-2 border-purple-300">
              <h3 className="text-lg font-bold text-gray-800 mb-3">
                📦 Step 2: Calculated Results
              </h3>
              <div className="text-center">
                <div className="text-4xl font-bold text-purple-700">
                  {restockingFormValues.sellingQtyInPeriod || 0}
                </div>
                <div className="text-lg text-gray-600 mt-1">
                  {restockingEditingProduct.units} sold in last{" "}
                  <span className="font-semibold">{restockingFormValues.salesPeriodDays}</span> days
                </div>
                <p className="text-sm text-gray-600 mt-2 italic">
                  ✓ This quantity will auto-fill the threshold & order qty below
                </p>
              </div>
            </div>

            {/* Step 3: Configuration Settings */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                ⚙️ Step 3: Auto-Filled Configuration (Edit if You Want)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Threshold */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    🚨 Reorder Threshold
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={restockingFormValues.threshold ?? restockingFormValues.sellingQtyInPeriod}
                      onChange={(e) =>
                        setRestockingFormValues((prev) => ({
                          ...prev,
                          threshold: parseInt(e.target.value) || 0,
                        }))
                      }
                      onBlur={() => {
                        // Auto-save instantly when user finishes editing
                        autoSaveThresholdOrQty(restockingFormValues);
                      }}
                      className="w-full px-3 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      placeholder="Enter threshold"
                    />
                    <span className="absolute right-3 top-3 text-gray-500 text-sm font-bold">
                      {restockingEditingProduct.units}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    Alert when stock falls below this. Auto-filled with calculated qty.
                  </p>
                </div>

                {/* Restocking Qty */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    🛒 Order Quantity
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={restockingFormValues.restockingQty ?? restockingFormValues.sellingQtyInPeriod}
                      onChange={(e) =>
                        setRestockingFormValues((prev) => ({
                          ...prev,
                          restockingQty: parseInt(e.target.value) || 0,
                        }))
                      }
                      onBlur={() => {
                        // Auto-save instantly when user finishes editing
                        autoSaveThresholdOrQty(restockingFormValues);
                      }}
                      className="w-full px-3 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      placeholder="Enter order qty"
                    />
                    <span className="absolute right-3 top-3 text-gray-500 text-sm font-bold">
                      {restockingEditingProduct.units}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    How much to order when threshold reached. Auto-filled with calculated qty.
                  </p>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-gray-400">
              <p className="text-sm font-bold text-gray-800 mb-3">📋 Configuration Summary:</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-white p-2 rounded">
                  <p className="text-gray-600">Period</p>
                  <p className="font-bold text-gray-800">
                    {restockingFormValues.salesPeriodDays} days
                  </p>
                </div>
                <div className="bg-white p-2 rounded">
                  <p className="text-gray-600">Selling Qty</p>
                  <p className="font-bold text-gray-800">
                    {restockingFormValues.sellingQtyInPeriod} {restockingEditingProduct.units}
                  </p>
                </div>
                <div className="bg-white p-2 rounded">
                  <p className="text-gray-600">Threshold</p>
                  <p className="font-bold text-purple-700">
                    {restockingFormValues.threshold ?? restockingFormValues.sellingQtyInPeriod}
                  </p>
                </div>
                <div className="bg-white p-2 rounded">
                  <p className="text-gray-600">Order Qty</p>
                  <p className="font-bold text-purple-700">
                    {restockingFormValues.restockingQty ?? restockingFormValues.sellingQtyInPeriod}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="bg-gray-50 px-6 py-4 rounded-b-xl flex gap-3 border-t sticky bottom-0">
            <button
              onClick={() => {
                setRestockingConfigMode(false);
                setRestockingEditingProduct(null);
              }}
              className="flex-1 px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-100 transition"
            >
              Close
            </button>
            <button
              onClick={() => {
                setRestockingConfigMode(false);
                setRestockingEditingProduct(null);
              }}
              className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold hover:from-green-600 hover:to-green-700 transition"
            >
              ✅ Configuration Saved!
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-16 md:pl-64 px-4 md:px-6 pb-10">
      <ToastContainer
        position="top-right"
        autoClose={3000}
        newestOnTop
        closeOnClick
        pauseOnHover
        theme="colored"
      />

      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <FaExclamationTriangle className="text-5xl opacity-80" />
              <div>
                <h1 className="text-4xl font-bold">Smart Restocking</h1>
                <p className="text-orange-100 mt-1">Automated Low Stock Alerts & Restocking</p>
              </div>
            </div>
            <button
              onClick={() => fetchAllData(currentPage, searchTerm)}
              disabled={loading}
              className="bg-white text-orange-600 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 transition disabled:opacity-50 flex items-center gap-2"
            >
              <FaSync className={loading ? "animate-spin" : ""} />
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {/* Search and Bulk Restock Bar */}
          <div className="flex gap-3 flex-wrap items-center">
            <div className="flex-1 min-w-64">
              <input
                type="text"
                placeholder="🔍 Search products by name..."
                value={searchTerm}
                onChange={handleSearch}
                className="w-full px-4 py-2 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>

            {/* Product Group Filter */}
            <select
              value={selectedProductGroup}
              onChange={(e) => {
                setSelectedProductGroup(e.target.value);
                setSelectedProducts(new Set()); // Clear selection when changing group
              }}
              className="px-4 py-2 rounded-lg text-gray-800 bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-300 font-semibold"
            >
              {allProductGroups.map((group) => (
                <option key={String(group)} value={String(group)}>
                  {String(group)} {group !== "All" ? `(${allProducts.filter((p) => {
                    const groupName = p.productGroup && typeof p.productGroup === 'object' 
                      ? (p.productGroup.name || p.productGroup._id)
                      : p.productGroup;
                    return groupName === group;
                  }).length})` : `(${allProducts.length})`}
                </option>
              ))}
            </select>

            {/* View Toggle */}
            <div className="flex gap-2 bg-white/30 p-1 rounded-lg">
              <button
                onClick={() => setViewMode("card")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition font-medium ${
                  viewMode === "card"
                    ? "bg-white text-orange-600 shadow-md"
                    : "text-white hover:bg-white/20"
                }`}
              >
                <FaThLarge size={16} /> Card
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition font-medium ${
                  viewMode === "table"
                    ? "bg-white text-orange-600 shadow-md"
                    : "text-white hover:bg-white/20"
                }`}
              >
                <FaList size={16} /> Table
              </button>
            </div>

            {selectedProducts.size > 0 && (
              <button
                onClick={handleBulkRestock}
                disabled={bulkRestockingInProgress}
                className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 whitespace-nowrap"
              >
                ✓ Restock {selectedProducts.size} Product{selectedProducts.size !== 1 ? "s" : ""} (1 PO)
              </button>
            )}
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between mt-4 px-4 py-3 bg-white rounded-lg">
            <div className="text-sm text-gray-600">
              <span className="font-semibold">Page {pagination.pages > 0 ? currentPage : 0} of {pagination.pages || 0}</span>
              <span className="ml-3">Total: <strong>{pagination.total}</strong> products</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1 || loading}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              
              <div className="flex items-center gap-2 px-3">
                {Array.from({ length: Math.min(5, pagination.pages) }).map((_, idx) => {
                  let pageNum;
                  if (pagination.pages <= 5) {
                    pageNum = idx + 1;
                  } else if (currentPage <= 3) {
                    pageNum = idx + 1;
                  } else if (currentPage >= pagination.pages - 2) {
                    pageNum = pagination.pages - 4 + idx;
                  } else {
                    pageNum = currentPage - 2 + idx;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-1 rounded-lg font-semibold transition ${
                        currentPage === pageNum
                          ? "bg-orange-500 text-white"
                          : "border border-gray-300 text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage(Math.min(pagination.pages, currentPage + 1))}
                disabled={currentPage === pagination.pages || pagination.pages === 0 || loading}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </div>
        </div>

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
            <table className="w-full">
              <thead className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-bold">
                    <input
                      type="checkbox"
                      checked={selectedProducts.size === filteredProducts.length && filteredProducts.length > 0}
                      onChange={() => {
                        if (selectedProducts.size === filteredProducts.length) {
                          setSelectedProducts(new Set());
                        } else {
                          setSelectedProducts(new Set(filteredProducts.map(p => p._id)));
                        }
                      }}
                      className="w-5 h-5 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Product Name</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Units</th>
                  <th className="px-4 py-3 text-right text-sm font-bold">Current Stock</th>
                  <th className="px-4 py-3 text-right text-sm font-bold">⏳ Pending Sales</th>
                  <th className="px-4 py-3 text-right text-sm font-bold">✓ Available</th>
                  <th className="px-4 py-3 text-right text-sm font-bold">Threshold</th>
                  <th className="px-4 py-3 text-right text-sm font-bold">Restock Qty</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Preferred Vendor</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Status</th>
                  <th className="px-4 py-3 text-center text-sm font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product, index) => {
                  const threshold = product.restockingConfig?.threshold ?? product.reorderLevel ?? 10;
                  const restockQty = product.restockingConfig?.restockingQty ?? product.reorderQty ?? 20;
                  
                  const stockStatus = 
                    product.totalQty === 0 ? "🔴 Out of Stock" :
                    product.totalQty < threshold ? "🟡 Low Stock" :
                    "🟢 Normal";
                  
                  const pendingQty = pendingSalesMap?.[product._id] || 0;
                  const availableQty = Math.max(0, product.totalQty - pendingQty);
                  
                  return (
                    <tr
                      key={product._id}
                      className={`${
                        index % 2 === 0 ? "bg-white" : "bg-gray-50"
                      } border-b border-gray-200 hover:bg-orange-50/30 transition`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedProducts.has(product._id)}
                          onChange={() => toggleProductSelection(product._id)}
                          className="w-5 h-5 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-800 text-sm">
                        {product.name}
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-sm">
                        {product.units}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800 text-sm">
                        {product.totalQty}
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        {pendingQty > 0 ? (
                          <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full font-semibold">
                            {pendingQty}
                          </span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-blue-700 text-sm">
                        {availableQty}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-800 text-sm font-bold">
                        {threshold}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800 text-sm">
                        {restockQty}
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-sm">
                        {product.preferredVendor || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {stockStatus}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => openRestockingConfigModal(product)}
                            className="px-3 py-1 bg-purple-500 text-white rounded font-semibold text-xs hover:bg-purple-600 transition"
                          >
                            📊 Config
                          </button>
                          <button
                            onClick={() => handleRestock(product)}
                            disabled={restockingInProgress[product._id] || !restockQty}
                            className={`px-3 py-1 rounded font-semibold text-xs transition ${
                              restockingInProgress[product._id]
                                ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                                : product.reorderQty
                                ? "bg-green-500 text-white hover:bg-green-600"
                                : "bg-gray-300 text-gray-600 cursor-not-allowed"
                            }`}
                          >
                            {restockingInProgress[product._id] ? "..." : "Restock"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EDIT MODAL */}
      {editingProduct && <EditModal />}

      {/* RESTOCKING CONFIG MODAL */}
      {restockingConfigMode && <RestockingConfigModal />}

      {/* BULK RESTOCK PREVIEW MODAL */}
      {bulkRestockPreviewMode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white p-6 rounded-t-xl sticky top-0">
              <h2 className="text-2xl font-bold">🛒 Grouped Restocking Preview</h2>
              <p className="text-orange-100 mt-1">Review and edit quantities before creating PO</p>
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
                      const qty = bulkRestockEditQty[product._id] || product.restockingConfig?.sellingQtyInPeriod || product.reorderQty || 20;
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
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-center font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500"
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
              <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-4 rounded-lg border-2 border-orange-300">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-gray-600">Subtotal</p>
                    <p className="text-lg font-bold text-orange-700">
                      ₹
                      {bulkRestockPreviewItems
                        .reduce(
                          (sum, p) =>
                            sum +
                            (bulkRestockEditQty[p._id] || p.restockingConfig?.sellingQtyInPeriod || p.reorderQty || 20) * p.purchasingPrice,
                          0
                        )
                        .toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Tax (GST)</p>
                    <p className="text-lg font-bold text-orange-700">
                      ₹
                      {bulkRestockPreviewItems
                        .reduce(
                          (sum, p) =>
                            sum +
                            ((bulkRestockEditQty[p._id] || p.restockingConfig?.sellingQtyInPeriod || p.reorderQty || 20) * p.purchasingPrice * (p.gst || 0)) /
                              100,
                          0
                        )
                        .toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Grand Total</p>
                    <p className="text-lg font-bold text-orange-700">
                      ₹
                      {(
                        bulkRestockPreviewItems.reduce(
                          (sum, p) =>
                            sum +
                            (bulkRestockEditQty[p._id] || p.restockingConfig?.sellingQtyInPeriod || p.reorderQty || 20) * p.purchasingPrice,
                          0
                        ) +
                        bulkRestockPreviewItems.reduce(
                          (sum, p) =>
                            sum +
                            ((bulkRestockEditQty[p._id] || p.restockingConfig?.sellingQtyInPeriod || p.reorderQty || 20) * p.purchasingPrice * (p.gst || 0)) /
                              100,
                          0
                        )
                      ).toFixed(2)}
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
                className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-orange-600 to-orange-700 text-white font-semibold hover:from-orange-700 hover:to-orange-800 transition disabled:opacity-50"
              >
                {bulkRestockingInProgress ? "⏳ Creating PO..." : "✅ Create PO"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
