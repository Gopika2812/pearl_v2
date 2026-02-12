import { useState } from "react";
import InventoryAddCustomerModal from "../../components/inventory/InventoryAddCustomerModal";
import InventoryAddProductGroupModal from "../../components/inventory/InventoryAddProductGroupModal";
import InventoryAddProductModal from "../../components/inventory/InventoryAddProductModal";
import InventoryAddVoucherTypeModal from "../../components/inventory/InventoryAddVoucherTypeModal";
import InventoryAddWarehouseModal from "../../components/inventory/InventoryAddWarehouseModal";
import InventorySalesOrderEntry from "../../components/inventory/InventorySalesOrderEntry";
import InventorySalesOrderHeader from "../../components/inventory/InventorySalesOrderHeader";
import { useInventory } from "../../context/InventoryContext";

import { FaSlidersH, FaTimes } from "react-icons/fa";

const InventorySalesOrder = () => {
  const { voucherTypes, productGroups, products, warehouses, addData, customers, salesMen, deliveryMen } = useInventory();

  const [activeModal, setActiveModal] = useState(null);
  const [items, setItems] = useState([]);
  const [showActions, setShowActions] = useState(true);
  const [mobileActions, setMobileActions] = useState(false);

  const soVoucherTypes = voucherTypes.filter(
    (v) => v.orderType === "SO"
  );

  const actionBtnClass =
    "w-full bg-primary text-white py-3 px-4 rounded-xl font-bold text-[13px] uppercase shadow hover:bg-[#248d94] transition";

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-16 md:pl-64">

      {/* ===== MOBILE QUICK ACTION TOP BAR ===== */}

      <div className="lg:hidden fixed top-60 right-0 z-40">
        <button
          onClick={() => setMobileActions(true)}
          className="bg-primary text-white h-8 w-10 flex items-center justify-center rounded-l-xl shadow-lg hover:bg-primary/90 transition"
          aria-label="Open Quick Links"
        >
          <FaSlidersH size={18} />
        </button>
      </div>


      {/* ===== MAIN WRAPPER ===== */}
      <div className="relative flex justify-center">

        {/* ===== CENTER CANVAS ===== */}
        <div
          className={`w-full max-w-6xl px-3 sm:px-6 py-4 transition-all ${showActions ? "lg:mr-80" : "lg:mr-0"
            }`}
        >
          <InventorySalesOrderHeader title="Sales Order" />

          <div className="mt-5">
            <InventorySalesOrderEntry
              items={items}
              setItems={setItems}
              voucherTypes={soVoucherTypes}
              productGroups={productGroups}
              products={products}
              warehouses={warehouses}
              customers={customers}
              salesMen={salesMen}
              deliveryMen={deliveryMen}
            />
          </div>
        </div>

        {/* ===== RIGHT QUICK ACTIONS (DESKTOP) ===== */}
        <aside
          className={`hidden lg:flex fixed right-0 top-16 h-[calc(100vh-4rem)] w-80 bg-white border-l shadow-xl p-5 flex-col z-40 transform transition-transform duration-300 ${showActions ? "translate-x-0" : "translate-x-full"
            }`}
        >
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="text-primary font-bold uppercase text-sm">
              Quick Links
            </h3>
            <button
              onClick={() => setShowActions(false)}
              className="text-primary hover:bg-primary/10 p-2 rounded"
            >
              <FaTimes />
            </button>
          </div>

          <div className="flex flex-col gap-3 mt-4">
            <button onClick={() => setActiveModal("voucher_type")} className={actionBtnClass}>+ Voucher</button>
            <button onClick={() => setActiveModal("product_group")} className={actionBtnClass}>+ Group</button>
            <button onClick={() => setActiveModal("product")} className={actionBtnClass}>+ Product</button>
            <button onClick={() => setActiveModal("warehouse")} className={actionBtnClass}>+ Warehouse</button>
            <button onClick={() => setActiveModal("customer")} className={actionBtnClass}>+ Customer</button>
          </div>
        </aside>

        {/* ===== DESKTOP OPEN TAB ===== */}
        {!showActions && (
          <button
            onClick={() => setShowActions(true)}
            className="hidden lg:flex fixed right-0 top-1/2 -translate-y-1/2 bg-primary text-white px-3 py-2 rounded-l-xl shadow z-50"
          >
            <FaSlidersH />
          </button>
        )}

        <div
          className={`lg:hidden fixed inset-0 z-50 transition ${mobileActions ? "opacity-100 visible" : "opacity-0 invisible"
            }`}
        >
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileActions(false)}
          />

          {/* Panel */}
          <aside
            className={`absolute right-0 top-16 h-[calc(100vh-4rem)] w-80 bg-white border-l shadow-xl p-5 flex flex-col z-50 transform transition-transform duration-300 ${mobileActions ? "translate-x-0" : "translate-x-full"
              }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-primary font-bold uppercase text-sm">
                Quick Links
              </h3>
              <button
                onClick={() => setMobileActions(false)}
                className="text-primary hover:bg-primary/10 p-2 rounded"
              >
                <FaTimes />
              </button>
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-3 mt-4">
              <button onClick={() => setActiveModal("voucher_type")} className={actionBtnClass}>+ Voucher</button>
              <button onClick={() => setActiveModal("product_group")} className={actionBtnClass}>+ Group</button>
              <button onClick={() => setActiveModal("product")} className={actionBtnClass}>+ Product</button>
              <button onClick={() => setActiveModal("warehouse")} className={actionBtnClass}>+ Warehouse</button>
              <button onClick={() => setActiveModal("customer")} className={actionBtnClass}>+ Customer</button>
            </div>
          </aside>
        </div>

      </div>

      {/* ===== MODALS ===== */}
      <InventoryAddVoucherTypeModal isOpen={activeModal === "voucher_type"} onClose={() => setActiveModal(null)} onSave={(data) => { addData("voucher", data); setActiveModal(null); }} />
      <InventoryAddProductGroupModal isOpen={activeModal === "product_group"} onClose={() => setActiveModal(null)} onSave={(data) => { addData("group", data); setActiveModal(null); }} />
      <InventoryAddProductModal isOpen={activeModal === "product"} onClose={() => setActiveModal(null)} onSave={(data) => { addData("product", data); setActiveModal(null); }} productGroups={productGroups} />
      <InventoryAddWarehouseModal isOpen={activeModal === "warehouse"} onClose={() => setActiveModal(null)} onSave={(data) => { addData("warehouse", data); setActiveModal(null); }} />
      <InventoryAddCustomerModal isOpen={activeModal === "customer"} onClose={() => setActiveModal(null)} onSave={(data) => { addData("customer", data); setActiveModal(null); }} />
    </div>
  );
};

export default InventorySalesOrder;
