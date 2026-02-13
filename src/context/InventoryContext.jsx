import { createContext, useContext, useEffect, useState } from "react";

const InventoryContext = createContext();

const API_BASE = import.meta.env.VITE_API_BASE_URL + "/api";


export const InventoryProvider = ({ children }) => {
  const [voucherTypes, setVoucherTypes] = useState([]);
  const [productGroups, setProductGroups] = useState([]);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [salesOwners, setSalesOwners] = useState([]);
  const [salesMen, setSalesMen] = useState([]);
  const [deliveryMen, setDeliveryMen] = useState([]);
  const [commissions, setCommissions] = useState([]);

  const [drafts, setDrafts] = useState([]);
  const [finalOrders, setFinalOrders] = useState([]);

  // 🔹 FETCH ALL MASTERS ON LOAD
  useEffect(() => {
    fetchVoucherTypes();
    fetchVendors();
    fetchProductGroups();
    fetchProducts();
    fetchWarehouses();
    fetchCustomers();
    fetchSalesOwners();
    fetchSalesMen();
    fetchDeliveryMen();
    fetchCommissions();
  }, []);

  const addLocalVoucher = (saved) => {
    setVoucherTypes(prev => [...prev, saved]);
  };


  const fetchVoucherTypes = async () => {
    try {
      const res = await fetch(`${API_BASE}/voucher-types`);
      const data = await res.json();
      setVoucherTypes(data.data || data);
    } catch (err) {
      console.error("Voucher fetch failed", err);
    }
  };

  const fetchVendors = async () => {
    try {
      const res = await fetch(`${API_BASE}/vendors`);
      const data = await res.json();
      setVendors(data.data || data);
    } catch (err) {
      console.error("Vendor fetch failed", err);
    }
  };

  const fetchProductGroups = async () => {
    try {
      const res = await fetch(`${API_BASE}/product-groups`);
      const data = await res.json();
      setProductGroups(data.data || data);
    } catch (err) {
      console.error("ProductGroup fetch failed", err);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_BASE}/products`);
      const json = await res.json();
      setProducts(json.data || []);
    } catch (err) {
      console.error("Product fetch failed", err);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const res = await fetch(`${API_BASE}/warehouses`);
      const json = await res.json();
      setWarehouses(json.data || []);
    } catch (err) {
      console.error("Warehouse fetch failed", err);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch(`${API_BASE}/customers`);
      const json = await res.json();
      setCustomers(json.data || []);
    } catch (err) {
      console.error("Customer fetch failed", err);
    }
  };

  const fetchSalesOwners = async () => {
    try {
      const res = await fetch(`${API_BASE}/sales-owners`);
      const json = await res.json();
      setSalesOwners(json.data || []);
    } catch (err) {
      console.error("Sales Owner fetch failed", err);
    }
  };

  const fetchSalesMen = async () => {
    try {
      const res = await fetch(`${API_BASE}/sales-men`);
      const json = await res.json();
      setSalesMen(json.data || []);
    } catch (err) {
      console.error("Sales Man fetch failed", err);
    }
  };

  const fetchDeliveryMen = async () => {
    try {
      const res = await fetch(`${API_BASE}/delivery-men`);
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

      if (type === "vendor") url = `${API_BASE}/vendors`;
      if (type === "group") url = `${API_BASE}/product-groups`;
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

      if (type === "vendor") setVendors(prev => [...prev, saved.data || saved]);
      if (type === "group") setProductGroups(prev => [...prev, saved.data || saved]);
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
        voucherTypes, productGroups, products, locations,
        warehouses, customers, vendors, salesOwners, salesMen, deliveryMen, commissions,
        drafts, finalOrders, fetchWarehouses, fetchCustomers, fetchCommissions,
        addData, addLocalVoucher, saveToDrafts, placeFinalOrder
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
