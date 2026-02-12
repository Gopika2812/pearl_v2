import { useState } from "react";
import { FaSlidersH, FaTimes } from "react-icons/fa";

// Modals
import InventoryAddCustomerModal from "../../components/inventory/InventoryAddCustomerModal";
import InventoryAddDeliveryManModal from "../../components/inventory/InventoryAddDeliveryManModal";
import InventoryAddProductGroupModal from "../../components/inventory/InventoryAddProductGroupModal";
import InventoryAddProductModal from "../../components/inventory/InventoryAddProductModal";
import InventoryAddSalesManModal from "../../components/inventory/InventoryAddSalesManModal";
import InventoryAddSalesOwnerModal from "../../components/inventory/InventoryAddSalesOwnerModal";
import InventoryAddVendorModal from "../../components/inventory/InventoryAddVendorModal";
import InventoryAddVoucherTypeModal from "../../components/inventory/InventoryAddVoucherTypeModal";
import InventoryAddWarehouseModal from "../../components/inventory/InventoryAddWarehouseModal";

import InventoryPurchaseOrderEntry from "../../components/inventory/InventoryPurchaseOrderEntry";
import InventoryPurchaseOrderHeader from "../../components/inventory/InventoryPurchaseOrderHeader";

import { useInventory } from "../../context/InventoryContext";

const InventoryPurchaseOrder = () => {
  const {
    voucherTypes, productGroups, products,
    warehouses, vendors, salesOwners, salesMen, deliveryMen, addData, addLocalVoucher
  } = useInventory();

  const [activeModal, setActiveModal] = useState(null);
  const [items, setItems] = useState([]);
  const [showActions, setShowActions] = useState(true);
  const [mobileActions, setMobileActions] = useState(false);

  const actionBtnClass =
    "w-full bg-primary text-white py-3 px-4 rounded-xl font-bold text-[13px] uppercase shadow hover:bg-[#248d94] transition text-left";

  const poVoucherTypes = voucherTypes.filter(
    (v) => v.orderType === "PO"
  );


  // Sidebar Links Data
  const quickLinks = [
    { id: "voucher_type", label: "+ Voucher Type" },
    { id: "vendor", label: "+ Vendor" },
    { id: "product_group", label: "+ Product Group" },
    { id: "product", label: "+ Product Name" },
    { id: "warehouse", label: "+ Warehouse" },
    { id: "customer", label: "+ Customer Details" },
    { id: "sales_owner", label: "+ Sales Owner" },
    { id: "sales_man", label: "+ Sales Man" },
    { id: "delivery_man", label: "+ Delivery Man" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-16 md:pl-64">

      {/* MOBILE TRIGGER */}
      <div className="lg:hidden fixed top-60 right-0 z-40">
        <button
          onClick={() => setMobileActions(true)}
          className="bg-primary text-white h-8 w-10 flex items-center justify-center rounded-l-xl shadow-lg"
        >
          <FaSlidersH size={18} />
        </button>
      </div>

      <div className="relative flex justify-center">
        {/* MAIN FORM AREA */}
        <div className={`w-full max-w-6xl px-3 sm:px-6 py-4 transition-all ${showActions ? "lg:mr-80" : "lg:mr-0"}`}>
          <InventoryPurchaseOrderHeader title="Purchase Order" />

          <div className="mt-5">
            <InventoryPurchaseOrderEntry
              items={items}
              setItems={setItems}
              voucherTypes={poVoucherTypes}
              productGroups={productGroups}
              products={products}
              warehouses={warehouses}
              vendors={vendors}
            />
          </div>
        </div>

        {/* QUICK LINKS SIDEBAR (Desktop) */}
        <aside className={`hidden lg:flex fixed right-0 top-16 h-[calc(100vh-4rem)] w-80 bg-white border-l shadow-xl p-5 flex-col z-40 transition-transform ${showActions ? "translate-x-0" : "translate-x-full"}`}>
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="text-primary font-bold uppercase text-sm">Quick Links</h3>
            <button onClick={() => setShowActions(false)} className="text-primary hover:bg-primary/10 p-2 rounded">
              <FaTimes />
            </button>
          </div>

          <div className="flex flex-col gap-3 mt-4 overflow-y-auto custom-scrollbar">
            {quickLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => setActiveModal(link.id)}
                className={actionBtnClass}
              >
                {link.label}
              </button>
            ))}
          </div>
        </aside>

        {/* MOBILE DRAWER */}
        <div className={`lg:hidden fixed inset-0 z-50 transition ${mobileActions ? "opacity-100 visible" : "opacity-0 invisible"}`}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileActions(false)} />
          <aside className={`absolute right-0 top-16 h-[calc(100vh-4rem)] w-80 bg-white border-l shadow-xl p-5 flex flex-col z-50 transition-transform ${mobileActions ? "translate-x-0" : "translate-x-full"}`}>
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-primary font-bold uppercase text-sm">Quick Links</h3>
              <button onClick={() => setMobileActions(false)} className="text-primary hover:bg-primary/10 p-2 rounded">
                <FaTimes />
              </button>
            </div>
            <div className="flex flex-col gap-3 mt-4 overflow-y-auto">
              {quickLinks.map((link) => (
                <button
                  key={link.id}
                  onClick={() => {
                    setActiveModal(link.id);
                    setMobileActions(false);
                  }}
                  className={actionBtnClass}
                >
                  {link.label}
                </button>
              ))}
            </div>
          </aside>
        </div>
      </div>

      {/* ALL MODALS */}
      <InventoryAddVoucherTypeModal
        isOpen={activeModal === "voucher_type"}
        onClose={() => setActiveModal(null)}
        onSave={(data) => {
          addLocalVoucher(data);
          setActiveModal(null);
        }}
      />

      <InventoryAddVendorModal
        isOpen={activeModal === "vendor"}
        onClose={() => setActiveModal(null)}
        onSave={(data) => {
          addData("vendor", data);
          setActiveModal(null);
        }}
      />

      <InventoryAddProductGroupModal
        isOpen={activeModal === "product_group"}
        onClose={() => setActiveModal(null)}
        onSave={(data) => { addData("group", data); setActiveModal(null); }}
      />

      <InventoryAddProductModal
        isOpen={activeModal === "product"}
        onClose={() => setActiveModal(null)}
        onSave={(data) => { addData("product", data); setActiveModal(null); }}
        productGroups={productGroups}
      />

      <InventoryAddWarehouseModal
        isOpen={activeModal === "warehouse"}
        onClose={() => setActiveModal(null)}
        onSave={(data) => { addData("warehouse", data); setActiveModal(null); }}
      />

      <InventoryAddCustomerModal
        isOpen={activeModal === "customer"}
        onClose={() => setActiveModal(null)}
        onSave={(data) => { addData("customer", data); setActiveModal(null); }}
        salesOwners={salesOwners}
      />

      <InventoryAddSalesOwnerModal
        isOpen={activeModal === "sales_owner"}
        onClose={() => setActiveModal(null)}
        onSave={(data) => { addData("sales_owner", data); setActiveModal(null); }}
      />

      <InventoryAddSalesManModal
        isOpen={activeModal === "sales_man"}
        onClose={() => setActiveModal(null)}
        onSave={(data) => { addData("sales_man", data); setActiveModal(null); }}
      />

      <InventoryAddDeliveryManModal
        isOpen={activeModal === "delivery_man"}
        onClose={() => setActiveModal(null)}
        onSave={(data) => { addData("delivery_man", data); setActiveModal(null); }}
      />
    </div>
  );
};

export default InventoryPurchaseOrder;
