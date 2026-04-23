import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import InventoryAddWarehouseModal from "../../components/inventory/InventoryAddWarehouseModal";
import CustomerCategoryAddModal from "../../components/inventory/CustomerCategoryAddModal";
import CustomerGroupAddModal from "../../components/inventory/CustomerGroupAddModal";
import InventoryAddCustomerModal from "../../components/inventory/InventoryAddCustomerModal";
import InventoryAddDeliveryManModal from "../../components/inventory/InventoryAddDeliveryManModal";
import InventoryAddProductCategoryModal from "../../components/inventory/InventoryAddProductCategoryModal";
import InventoryAddProductGroupModal from "../../components/inventory/InventoryAddProductGroupModal";
import InventoryAddProductModal from "../../components/inventory/InventoryAddProductModal";
import InventoryAddSalesManModal from "../../components/inventory/InventoryAddSalesManModal";
import InventoryAddSalesOwnerModal from "../../components/inventory/InventoryAddSalesOwnerModal";
import InventoryAddVendorModal from "../../components/inventory/InventoryAddVendorModal";
import InventoryAddVoucherTypeModal from "../../components/inventory/InventoryAddVoucherTypeModal";
import QuickLinksDataManager from "../../components/QuickLinksDataManager";
import { useBranch } from "../../context/BranchContext";
import { useInventory } from "../../context/InventoryContext";
import {
  FaBox, FaBuilding, FaChevronRight, FaFileAlt, FaHandshake,
  FaLink, FaPlus, FaShoppingCart, FaTruck, FaUsers, FaWarehouse, FaTags, FaStore, FaUserLock,
  FaUserTie, FaUserTag, FaLayerGroup, FaMapMarkerAlt, FaFileInvoice, FaShieldAlt
} from "react-icons/fa";
import { QUICK_LINKS_CONFIG, QUICK_LINKS_CATEGORIES } from "../../utils/quickLinksConfig";

export default function BranchQuickLinks() {
  const location = useLocation();
  const {
    productGroups, productCategories, customerCategories,
    customerGroups, warehouses, updateData, addData,
    addLocalVoucher, addLocalWarehouse, salesOwners
  } = useInventory();
  const { currentBranch, user } = useBranch();
  const [activeModal, setActiveModal] = useState(null);
  const [viewingData, setViewingData] = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  // Sync viewingData with URL query param
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const type = params.get("type");
    if (type && QUICK_LINKS_CONFIG[type]) {
      setViewingData(type);
    } else {
      setViewingData(null);
    }
  }, [location.search]);

  const branchId = currentBranch?._id;

  const categories = QUICK_LINKS_CATEGORIES.map(cat => ({
    title: cat.title,
    items: cat.items.map(itemId => {
      const config = QUICK_LINKS_CONFIG[itemId];
      const iconMap = {
        voucher_type: <FaFileInvoice />,
        warehouse: <FaMapMarkerAlt />,
        product_group: <FaLayerGroup />,
        product_category: <FaTags />,
        product: <FaBox />,
        customer_category: <FaUserTag />,
        customer_group: <FaUsers />,
        customer: <FaBuilding />,
        vendor: <FaHandshake />,
        sales_owner: <FaUserLock />,
        sales_man: <FaUserTie />,
        delivery_man: <FaTruck />
      };
      return {
        id: itemId,
        label: config.label,
        icon: iconMap[itemId] || <FaLink />,
        path: `/quick-links/${itemId.replace(/_/g, '-')}`
      };
    })
  }));

  const filteredCategories = categories.map(cat => ({
    ...cat,
    items: cat.items.filter(item => {
      if (!user?.allowedQuickLinks || user.allowedQuickLinks.length === 0) return true;
      return user.allowedQuickLinks.includes(item.id);
    })
  })).filter(cat => cat.items.length > 0);

  const handleAddData = (type, data) => {
    // Check if this is an update (has _id) or create
    if (data._id) {
      // This is an update
      const { _id, ...updatePayload } = data;
      updateData(type, _id, updatePayload);
    } else {
      // This is a create
      const dataWithBranch = { ...data, branchId };
      addData(type, dataWithBranch);
    }
    setActiveModal(null);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pt-20 md:pt-4 md:pl-20 px-3 md:px-6 pb-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-sm border border-white/50 p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-tr from-primary to-blue-600 p-3 rounded-xl shadow-lg shadow-primary/20">
              <FaLink className="text-lg text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">Master Data Hub</h1>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em] mt-0.5 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                System Configuration Center
              </p>
            </div>
          </div>
          {viewingData ? (
            <button
              onClick={() => setViewingData(null)}
              className="bg-gray-900 hover:bg-gray-800 text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest transition-all flex items-center gap-2 text-xs shadow-xl shadow-gray-200"
            >
              <FaChevronRight className="rotate-180" /> Back to Overview
            </button>
          ) : (
            <div className="flex items-center gap-3 bg-gray-50/50 p-2 rounded-2xl border border-gray-100">
              <div className="px-4 py-2 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center gap-2">
                <FaShieldAlt className="text-primary text-xs" />
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Admin Access Only</span>
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        {viewingData ? (
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <QuickLinksDataManager
              type={viewingData}
              onCancel={() => setViewingData(null)}
              onEdit={(item) => {
                setEditingItem(item);
                setActiveModal(viewingData);
              }}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filteredCategories.map((cat, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 group/card"
              >
                <div className={`bg-gradient-to-br ${cat.color} px-5 py-4 text-white flex items-center justify-between relative overflow-hidden`}>
                  <div className="relative z-10 flex items-center gap-3">
                    <div className="bg-white/20 backdrop-blur-md p-2.5 rounded-xl shadow-inner group-hover/card:scale-110 transition-transform duration-500">
                      <span className="text-xl">{cat.icon}</span>
                    </div>
                    <div>
                      <h2 className="text-base font-black tracking-tight text-white">{cat.title}</h2>
                      <p className="text-white/70 text-[10px] font-bold uppercase tracking-[0.2em] mt-0.5">{cat.items.length} Master Modules</p>
                    </div>
                  </div>
                  <div className="absolute -right-3 -bottom-3 text-white/10 text-6xl font-black rotate-12 pointer-events-none select-none">
                    {cat.icon}
                  </div>
                </div>
                <div className="p-3">
                  <div className="grid grid-cols-1 gap-1">
                    {cat.items.map((item) => (
                      <div
                        key={item.id}
                        className="px-3 py-3 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all flex items-center justify-between group/item"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 group-hover/item:bg-primary/10 group-hover/item:text-primary transition-all shadow-sm">
                            <span className="text-base">{item.icon}</span>
                          </div>
                          <div className="flex-1 min-w-0 mr-3">
                            <h3 className="font-bold text-gray-800 text-sm group-hover/item:text-primary transition-colors">{item.label}</h3>
                            <p className="text-[10px] text-gray-400 truncate mt-0.5 font-medium">{QUICK_LINKS_CONFIG[item.id]?.desc || "Technical configuration"}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setActiveModal(item.id)}
                            className="bg-white border border-gray-200 hover:border-primary hover:text-primary text-gray-600 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
                          >
                            <FaPlus size={7} /> Add
                          </button>
                          <button
                            onClick={() => setViewingData(item.id)}
                            className="bg-primary hover:bg-primary/90 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all active:scale-95 shadow-lg shadow-primary/20"
                          >
                            Manage
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== ALL MODALS ===== */}
      <InventoryAddVoucherTypeModal
        isOpen={activeModal === "voucher_type"}
        onClose={() => { setActiveModal(null); setEditingItem(null); }}
        onSave={(data) => {
          addLocalVoucher(data);
          setActiveModal(null);
          setEditingItem(null);
        }}
        editingItem={editingItem}
        branchId={branchId}
      />

      <InventoryAddWarehouseModal
        isOpen={activeModal === "warehouse"}
        onClose={() => { setActiveModal(null); setEditingItem(null); }}
        onSave={(data) => {
          addLocalWarehouse(data);
          setActiveModal(null);
          setEditingItem(null);
        }}
        editingItem={editingItem}
        branchId={branchId}
      />

      <InventoryAddProductGroupModal
        isOpen={activeModal === "product_group"}
        onClose={() => { setActiveModal(null); setEditingItem(null); }}
        onSave={(data) => { handleAddData("group", data); setEditingItem(null); }}
        editingItem={editingItem}
        branchId={branchId}
      />

      <InventoryAddProductCategoryModal
        isOpen={activeModal === "product_category"}
        onClose={() => { setActiveModal(null); setEditingItem(null); }}
        onSave={(data) => { handleAddData("category", data); setEditingItem(null); }}
        editingItem={editingItem}
        branchId={branchId}
      />

      <InventoryAddProductModal
        isOpen={activeModal === "product"}
        onClose={() => { setActiveModal(null); setEditingItem(null); }}
        onSave={(data) => { handleAddData("product", data); setEditingItem(null); }}
        productGroups={productGroups}
        productCategories={productCategories}
        warehouses={warehouses}
        editingItem={editingItem}
        branchId={branchId}
      />

      <CustomerCategoryAddModal
        isOpen={activeModal === "customer_category"}
        onClose={() => { setActiveModal(null); setEditingItem(null); }}
        onSave={(data) => { handleAddData("customer_category", data); setEditingItem(null); }}
        editingItem={editingItem}
        branchId={branchId}
      />

      <CustomerGroupAddModal
        isOpen={activeModal === "customer_group"}
        onClose={() => { setActiveModal(null); setEditingItem(null); }}
        onSave={(data) => { handleAddData("customer_group", data); setEditingItem(null); }}
        editingItem={editingItem}
        branchId={branchId}
      />

      <InventoryAddCustomerModal
        isOpen={activeModal === "customer"}
        onClose={() => { setActiveModal(null); setEditingItem(null); }}
        onSave={(data) => { handleAddData("customer", data); setEditingItem(null); }}
        salesOwners={salesOwners}
        customerCategories={customerCategories}
        customerGroups={customerGroups}
        editingItem={editingItem}
        branchId={branchId}
      />

      <InventoryAddVendorModal
        isOpen={activeModal === "vendor"}
        onClose={() => { setActiveModal(null); setEditingItem(null); }}
        onSave={(data) => { handleAddData("vendor", data); setEditingItem(null); }}
        editingItem={editingItem}
        branchId={branchId}
      />

      <InventoryAddSalesOwnerModal
        isOpen={activeModal === "sales_owner"}
        onClose={() => { setActiveModal(null); setEditingItem(null); }}
        onSave={(data) => { handleAddData("sales_owner", data); setEditingItem(null); }}
        editingItem={editingItem}
        branchId={branchId}
      />

      <InventoryAddSalesManModal
        isOpen={activeModal === "sales_man"}
        onClose={() => { setActiveModal(null); setEditingItem(null); }}
        onSave={(data) => { handleAddData("sales_man", data); setEditingItem(null); }}
        editingItem={editingItem}
        branchId={branchId}
      />

      <InventoryAddDeliveryManModal
        isOpen={activeModal === "delivery_man"}
        onClose={() => { setActiveModal(null); setEditingItem(null); }}
        onSave={(data) => { handleAddData("delivery_man", data); setEditingItem(null); }}
        editingItem={editingItem}
        branchId={branchId}
      />
    </div>
  );
}
