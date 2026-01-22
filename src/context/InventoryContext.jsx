import { createContext, useContext, useState } from "react";

const InventoryContext = createContext();

export const InventoryProvider = ({ children }) => {
  // Always initialize with [] to prevent ".map() is undefined" errors
  const [voucherTypes, setVoucherTypes] = useState([]);
  const [productGroups, setProductGroups] = useState([]);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [agents, setAgents] = useState([]);
  const [billingPersons, setBillingPersons] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);

  // A single, clean function to handle all Master additions
  const addData = (type, data) => {
    const newItem = { ...data, id: Date.now() }; // Add a unique ID

    switch (type) {
      case "voucher": setVoucherTypes(prev => [...prev, newItem]); break;
      case "group": setProductGroups(prev => [...prev, newItem]); break;
      case "product": setProducts(prev => [...prev, newItem]); break;
      case "location": setLocations(prev => [...prev, newItem]); break;
      case "warehouse": setWarehouses(prev => [...prev, newItem]); break;
      case "agent": setAgents(prev => [...prev, newItem]); break;
      case "billing": setBillingPersons(prev => [...prev, newItem]); break;
      case "customer": setCustomers(prev => [...prev, newItem]); break;
      case "vendor": setVendors(prev => [...prev, newItem]); break;

      default: console.warn(`Unknown data type: ${type}`);
    }
  };

  return (
    <InventoryContext.Provider value={{ 
      voucherTypes, productGroups, products, 
      locations, warehouses, agents, billingPersons, customers,vendors,
      addData 
    }}>
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) throw new Error("useInventory must be used within InventoryProvider");
  return context;
};