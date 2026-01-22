import { createContext, useContext, useState } from "react";

const InventoryContext = createContext();

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

  // NEW: State for Drafts and Final Orders
  const [drafts, setDrafts] = useState([]);
  const [finalOrders, setFinalOrders] = useState([]);

  // Function to save PO as a Draft
  const saveToDrafts = (orderData) => {
    setDrafts(prev => [...prev, { ...orderData, status: "Draft", id: Date.now() }]);
    alert("Purchase Order saved as Draft!");
  };

  // Function to finalize and place the PO
  const placeFinalOrder = (orderData) => {
    setFinalOrders(prev => [...prev, { ...orderData, status: "Placed", id: Date.now() }]);
  };

  const addData = (type, data) => {
    const newItem = { ...data, id: Date.now() };
    switch (type) {
      case "voucher": setVoucherTypes(prev => [...prev, newItem]); break;
      case "group": setProductGroups(prev => [...prev, newItem]); break;
      case "product": setProducts(prev => [...prev, newItem]); break;
      case "location": setLocations(prev => [...prev, newItem]); break;
      case "warehouse": setWarehouses(prev => [...prev, newItem]); break;
      case "agent": setAgents(prev => [...prev, newItem]); break;
      case "billing_person": setBillingPersons(prev => [...prev, newItem]); break;
      case "customer": setCustomers(prev => [...prev, newItem]); break;
      case "vendor": setVendors(prev => [...prev, newItem]); break;
      default: console.warn("Unknown addData type:", type);
    }
  };

  return (
    <InventoryContext.Provider
      value={{
        voucherTypes, productGroups, products, locations,
        warehouses, agents, billingPersons, customers, vendors,
        drafts, finalOrders, // Exported new states
        addData, saveToDrafts, placeFinalOrder // Exported new functions
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