import { createContext, useContext, useEffect, useState } from "react";

const InventoryContext = createContext();

const API_BASE = "http://localhost:5000/api";

export const InventoryProvider = ({ children }) => {
  const [voucherTypes, setVoucherTypes] = useState([]);
  const [productGroups, setProductGroups] = useState([]);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [agents, setAgents] = useState([]);
  const [billingPersons, setBillingPersons] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);

  const [drafts, setDrafts] = useState([]);
  const [finalOrders, setFinalOrders] = useState([]);

  // 🔹 FETCH ALL MASTERS ON LOAD
  useEffect(() => {
    fetchVoucherTypes();
    fetchVendors();
    fetchProductGroups();
    fetchProducts();
    fetchWarehouses();
    fetchAgents();
    fetchBillingPersons();
    fetchCustomers();
  }, []);

  const addLocalVoucher = (saved) => {
    setVoucherTypes(prev => [...prev, saved]);
  };


  const fetchVoucherTypes = async () => {
    try {
      const res = await fetch(`${API_BASE}/voucher-types`);
      const data = await res.json();
      setVoucherTypes(data);
    } catch (err) {
      console.error("Voucher fetch failed", err);
    }
  };

  const fetchVendors = async () => {
    try {
      const res = await fetch(`${API_BASE}/vendors`);
      const data = await res.json();
      setVendors(data);
    } catch (err) {
      console.error("Vendor fetch failed", err);
    }
  };

  const fetchProductGroups = async () => {
    try {
      const res = await fetch(`${API_BASE}/product-groups`);
      const data = await res.json();
      setProductGroups(data);
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

  const fetchAgents = async () => {
    try {
      const res = await fetch(`${API_BASE}/agents`);
      const data = await res.json();
      setAgents(data);
    } catch (err) {
      console.error("Agent fetch failed", err);
    }
  };

  const fetchBillingPersons = async () => {
    try {
      const res = await fetch(`${API_BASE}/billing-persons`);
      const json = await res.json();
      setBillingPersons(json.data || []);
    } catch (err) {
      console.error("Billing person fetch failed", err);
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
      if (type === "agent") url = `${API_BASE}/agents`;
      if (type === "billing") url = `${API_BASE}/billing-persons`;
      if (type === "customer") url = `${API_BASE}/customers`; // ✅ ADD THIS



      if (!url) {
        console.warn("No API for type:", type);
        return;
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const text = await res.text(); // ← safer parse
      const saved = text ? JSON.parse(text) : {};

      if (!res.ok) throw new Error(saved.message || "Save failed");


      if (type === "vendor") setVendors(prev => [...prev, saved]);
      if (type === "group") setProductGroups(prev => [...prev, saved]);
      if (type === "product") setProducts(prev => [...prev, saved]);
      if (type === "warehouse") setWarehouses(prev => [...prev, saved]);
      if (type === "agent") setAgents(prev => [...prev, saved]);
      if (type === "billing") setBillingPersons(prev => [...prev, saved]);
      if (type === "customer") setCustomers(prev => [...prev, saved.data || saved]);

    } catch (err) {
      alert("Save failed: " + err.message);
    }
  };


  return (
    <InventoryContext.Provider
      value={{
        voucherTypes, productGroups, products, locations,
        warehouses, agents, billingPersons, customers, vendors,
        drafts, finalOrders, fetchWarehouses, fetchAgents, fetchBillingPersons, fetchCustomers,
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
