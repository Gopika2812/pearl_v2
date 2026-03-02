import { createContext, useContext, useEffect, useState } from "react";
import { useBranch } from "./BranchContext";

const InventoryContext = createContext();

const API_BASE = import.meta.env.VITE_API_BASE_URL + "/api";


export const InventoryProvider = ({ children }) => {
  const { currentBranch } = useBranch();
  const [voucherTypes, setVoucherTypes] = useState([]);
  const [productGroups, setProductGroups] = useState([]);
  const [productCategories, setProductCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerCategories, setCustomerCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [salesOwners, setSalesOwners] = useState([]);
  const [salesMen, setSalesMen] = useState([]);
  const [deliveryMen, setDeliveryMen] = useState([]);
  const [commissions, setCommissions] = useState([]);

  const [drafts, setDrafts] = useState([]);
  const [finalOrders, setFinalOrders] = useState([]);

  useEffect(() => {
    if (!currentBranch?._id) return; // Skip if no branch selected
    
    fetchVoucherTypes();
    fetchVendors();
    fetchProductGroups();
    fetchProductCategories();
    fetchProducts();
    fetchWarehouses();
    fetchCustomers();
    fetchCustomerCategories();
    fetchSalesOwners();
    fetchSalesMen();
    fetchDeliveryMen();
    fetchCommissions();
  }, [currentBranch?._id]);

  const addLocalVoucher = (saved) => {
    setVoucherTypes(prev => [...prev, saved]);
  };

  const addLocalWarehouse = (saved) => {
    setWarehouses(prev => [...prev, saved]);
  };

  const addLocalProductCategory = (saved) => {
    setProductCategories(prev => [...prev, saved]);
  };

  const addLocalCustomerCategory = (saved) => {
    setCustomerCategories(prev => [...prev, saved]);
  };

  const fetchVoucherTypes = async () => {
    try {
      const branchId = currentBranch?._id;
      if (!branchId) return;
      
      const res = await fetch(`${API_BASE}/voucher-types?branchId=${branchId}`);
      const data = await res.json();
      setVoucherTypes(data.data || data);
    } catch (err) {
      console.error("Voucher fetch failed", err);
    }
  };

  const fetchVendors = async () => {
    try {
      const branchId = currentBranch?._id;
      if (!branchId) return;
      
      const res = await fetch(`${API_BASE}/vendors?branchId=${branchId}`);
      const data = await res.json();
      setVendors(data.data || data);
    } catch (err) {
      console.error("Vendor fetch failed", err);
    }
  };

  const fetchProductGroups = async () => {
    try {
      const branchId = currentBranch?._id;
      if (!branchId) {
        console.log("⚠️ No branchId for fetchProductGroups");
        return;
      }
      
      console.log(`📦 Fetching ProductGroups for branchId: ${branchId}`);
      const res = await fetch(`${API_BASE}/product-groups?branchId=${branchId}`);
      
      if (!res.ok) {
        throw new Error(`API error: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log(`📦 ProductGroups raw response:`, data);
      console.log(`📦 Is array? ${Array.isArray(data)}`);
      
      const groupsData = Array.isArray(data) ? data : (data.data || []);
      console.log(`📦 Processed groups: ${groupsData.length} items`, groupsData.map(g => ({ _id: g._id, name: g.name })));
      
      setProductGroups(groupsData);
    } catch (err) {
      console.error("❌ ProductGroup fetch failed", err);
      setProductGroups([]);
    }
  };

  const fetchProductCategories = async () => {
    try {
      const branchId = currentBranch?._id;
      if (!branchId) {
        console.log("⚠️ No branchId for fetchProductCategories");
        return;
      }
      
      console.log(`🏷️ Fetching ProductCategories for branchId: ${branchId}`);
      const res = await fetch(`${API_BASE}/product-categories?branchId=${branchId}`);
      
      if (!res.ok) {
        throw new Error(`API error: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log(`🏷️ ProductCategories raw response:`, data);
      console.log(`🏷️ Is array? ${Array.isArray(data)}`);
      
      const categoriesData = Array.isArray(data) ? data : (data.data || []);
      console.log(`🏷️ Processed categories: ${categoriesData.length} items`, categoriesData.map(c => ({ _id: c._id, name: c.name })));
      
      setProductCategories(categoriesData);
    } catch (err) {
      console.error("❌ ProductCategory fetch failed", err);
      setProductCategories([]);
    }
  };

  const fetchCustomerCategories = async () => {
    try {
      const branchId = currentBranch?._id;
      if (!branchId) {
        console.log("⚠️ No branchId for fetchCustomerCategories");
        return;
      }
      
      console.log(`👥 Fetching CustomerCategories for branchId: ${branchId}`);
      const res = await fetch(`${API_BASE}/customer-categories?branchId=${branchId}`);
      
      if (!res.ok) {
        throw new Error(`API error: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log(`👥 CustomerCategories raw response:`, data);
      console.log(`👥 Is array? ${Array.isArray(data)}`);
      
      const categoriesData = Array.isArray(data) ? data : (data.data || []);
      console.log(`👥 Processed categories: ${categoriesData.length} items`, categoriesData.map(c => ({ _id: c._id, name: c.name })));
      
      setCustomerCategories(categoriesData);
    } catch (err) {
      console.error("❌ CustomerCategory fetch failed", err);
      setCustomerCategories([]);
    }
  };

  const fetchProducts = async () => {
    try {
      const branchId = currentBranch?._id;
      if (!branchId) {
        console.log("⚠️ No branchId for fetchProducts");
        return;
      }
      
      console.log(`🔌 Fetching Products for branchId: ${branchId}`);
      const res = await fetch(`${API_BASE}/products?branchId=${branchId}`);
      
      if (!res.ok) {
        throw new Error(`API error: ${res.status} ${res.statusText}`);
      }
      
      const json = await res.json();
      console.log(`🔌 Products raw response:`, json);
      console.log(`🔌 Is array? ${Array.isArray(json)}`);
      
      const productsData = Array.isArray(json) ? json : (json.data || []);
      console.log(`🔌 Processed products: ${productsData.length} items`, productsData.map(p => ({ _id: p._id, name: p.name })));
      
      setProducts(productsData);
    } catch (err) {
      console.error("❌ Product fetch failed", err);
      setProducts([]);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const branchId = currentBranch?._id;
      if (!branchId) return;
      
      const res = await fetch(`${API_BASE}/warehouses?branchId=${branchId}`);
      const json = await res.json();
      setWarehouses(json.data || []);
    } catch (err) {
      console.error("Warehouse fetch failed", err);
    }
  };

  const fetchCustomers = async () => {
    try {
      const branchId = currentBranch?._id;
      if (!branchId) return;
      
      const res = await fetch(`${API_BASE}/customers?branchId=${branchId}`);
      const json = await res.json();
      setCustomers(json.data || []);
    } catch (err) {
      console.error("Customer fetch failed", err);
    }
  };

  const fetchSalesOwners = async () => {
    try {
      const branchId = currentBranch?._id;
      if (!branchId) return;
      
      const res = await fetch(`${API_BASE}/sales-owners?branchId=${branchId}`);
      const json = await res.json();
      setSalesOwners(json.data || []);
    } catch (err) {
      console.error("Sales Owner fetch failed", err);
    }
  };

  const fetchSalesMen = async () => {
    try {
      const branchId = currentBranch?._id;
      if (!branchId) return;
      
      const res = await fetch(`${API_BASE}/sales-men?branchId=${branchId}`);
      const json = await res.json();
      setSalesMen(json.data || []);
    } catch (err) {
      console.error("Sales Man fetch failed", err);
    }
  };

  const fetchDeliveryMen = async () => {
    try {
      const branchId = currentBranch?._id;
      if (!branchId) return;
      
      const res = await fetch(`${API_BASE}/delivery-men?branchId=${branchId}`);
      const json = await res.json();
      setDeliveryMen(json.data || []);
    } catch (err) {
      console.error("Delivery Man fetch failed", err);
    }
  };

  const fetchCommissions = async () => {
    try {
      const res = await fetch(`${API_BASE}/sales-orders/commissions`);
      const json = await res.json();
      setCommissions(json.data || []);
    } catch (err) {
      console.error("Commission fetch failed", err);
    }
  };


  // 🔹 SAVE PO AS DRAFT (still frontend for now)
  const saveToDrafts = (orderData) => {
    setDrafts(prev => [...prev, { ...orderData, status: "Draft", id: Date.now() }]);
    alert("Purchase Order saved as Draft!");
  };

  const placeFinalOrder = (orderData) => {
    setFinalOrders(prev => [...prev, { ...orderData, status: "Placed", id: Date.now() }]);
  };

  // 🔹 ADD DATA → CALL BACKEND + REFRESH STATE
  const addData = async (type, data) => {
    try {
      if (!data || typeof data !== "object") {
        throw new Error("Invalid data payload");
      }

      let url = "";

      if (type === "voucher") url = `${API_BASE}/voucher-types`;
      if (type === "vendor") url = `${API_BASE}/vendors`;
      if (type === "group") url = `${API_BASE}/product-groups`;
      if (type === "category") url = `${API_BASE}/product-categories`;
      if (type === "customer_category") url = `${API_BASE}/customer-categories`;
      if (type === "product") url = `${API_BASE}/products`;
      if (type === "warehouse") url = `${API_BASE}/warehouses`;
      if (type === "customer") url = `${API_BASE}/customers`;
      if (type === "sales_owner") url = `${API_BASE}/sales-owners`;
      if (type === "sales_man") url = `${API_BASE}/sales-men`;
      if (type === "delivery_man") url = `${API_BASE}/delivery-men`;

      if (!url) {
        console.warn("No API for type:", type);
        return;
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const text = await res.text(); 
      const saved = text ? JSON.parse(text) : {};

      if (!res.ok) throw new Error(saved.message || "Save failed");

      if (type === "voucher") setVoucherTypes(prev => [...prev, saved.data || saved]);
      if (type === "vendor") setVendors(prev => [...prev, saved.data || saved]);
      if (type === "group") setProductGroups(prev => [...prev, saved.data || saved]);
      if (type === "category") setProductCategories(prev => [...prev, saved.data || saved]);
      if (type === "customer_category") setCustomerCategories(prev => [...prev, saved.data || saved]);
      if (type === "product") setProducts(prev => [...prev, saved.data || saved]);
      if (type === "warehouse") setWarehouses(prev => [...prev, saved.data || saved]);
      if (type === "customer") setCustomers(prev => [...prev, saved.data || saved]);
      if (type === "sales_owner") setSalesOwners(prev => [...prev, saved.data || saved]);
      if (type === "sales_man") setSalesMen(prev => [...prev, saved.data || saved]);
      if (type === "delivery_man") setDeliveryMen(prev => [...prev, saved.data || saved]);

    } catch (err) {
      alert("Save failed: " + err.message);
    }
  };


  return (
    <InventoryContext.Provider
      value={{
        voucherTypes, productGroups, productCategories, customerCategories, products, locations,
        warehouses, customers, vendors, salesOwners, salesMen, deliveryMen, commissions,
        drafts, finalOrders, fetchWarehouses, fetchCustomers, fetchCommissions,
        addData, addLocalVoucher, addLocalWarehouse, addLocalProductCategory, addLocalCustomerCategory, saveToDrafts, placeFinalOrder
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) throw new Error("useInventory must be used within InventoryProvider");
  return context;
};
