import { useState } from "react";
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
  FaLink, FaPlus, FaShoppingCart, FaTruck, FaUsers 
} from "react-icons/fa";

export default function BranchQuickLinks() {
  const { 
    productGroups, productCategories, customerCategories, 
    customerGroups, warehouses, updateData, addData,
    addLocalVoucher, addLocalWarehouse, salesOwners 
  } = useInventory();
  const { currentBranch } = useBranch();
  const [activeModal, setActiveModal] = useState(null);
  const [viewingData, setViewingData] = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  const branchId = currentBranch?._id;

  const categories = [
    {
      title: "System & Billing",
      icon: <FaFileAlt />,
      color: "from-blue-600 to-blue-700",
      items: [
        { id: "voucher_type", label: "Voucher Type", desc: "Manage billing prefixes and counters" },
        { id: "warehouse", label: "Warehouse", desc: "Configure storage locations" },
      ]
    },
    {
      title: "Inventory Master",
      icon: <FaBox />,
      color: "from-emerald-600 to-emerald-700",
      items: [
        { id: "product_group", label: "Product Group", desc: "High-level product classification" },
        { id: "product_category", label: "Product Category", desc: "Sub-levels and item organization" },
        { id: "product", label: "Product", desc: "Pricing, GST, and stock details" },
      ]
    },
    {
      title: "Customer Management",
      icon: <FaUsers />,
      color: "from-purple-600 to-purple-700",
      items: [
        { id: "customer_category", label: "Customer Category", desc: "Retail, Wholesale, etc." },
        { id: "customer_group", label: "Customer Group", desc: "Grouping for loyalty or analysis" },
        { id: "customer", label: "Customer", desc: "Full CRM and contact details" },
      ]
    },
    {
      title: "People & Logistics",
      icon: <FaHandshake />,
      color: "from-orange-600 to-orange-700",
      items: [
        { id: "vendor", label: "Vendor", desc: "Supplier records and GSTIN" },
        { id: "sales_owner", label: "Sales Owner", desc: "Primary account managers" },
        { id: "sales_man", label: "Sales Man", desc: "Field staff and representatives" },
        { id: "delivery_man", label: "Delivery Man", desc: "Dispatch and transport personnel" },
      ]
    }
  ];

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
    <div className="min-h-screen bg-[#f8fafc] pt-20 md:pt-4 md:pl-20 px-4 md:px-8 pb-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-2.5 rounded-xl">
              <FaLink className="text-xl text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight">Master Data Hub</h1>
              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">Streamline system configuration</p>
            </div>
          </div>
          {viewingData && (
            <button
              onClick={() => setViewingData(null)}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 text-sm"
            >
              <FaChevronRight className="rotate-180" /> Back to Hub
            </button>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {categories.map((cat, idx) => (
              <div 
                key={idx} 
                className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className={`bg-gradient-to-r ${cat.color} p-6 text-white flex items-center gap-4`}>
                  <span className="text-2xl opacity-90">{cat.icon}</span>
                  <h2 className="text-xl font-bold tracking-wide uppercase">{cat.title}</h2>
                </div>
                
                <div className="p-2">
                  <div className="divide-y divide-gray-50">
                    {cat.items.map((item) => (
                      <div key={item.id} className="p-4 hover:bg-gray-50/80 transition-colors flex items-center justify-between group">
                        <div className="flex-1 min-w-0 mr-4">
                          <h3 className="font-bold text-gray-800 group-hover:text-primary transition-colors">{item.label}</h3>
                          <p className="text-xs text-gray-500 truncate mt-0.5">{item.desc}</p>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 lg:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setActiveModal(item.id)}
                            className="bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                          >
                            <FaPlus size={10} /> Add
                          </button>
                          <button
                            onClick={() => setViewingData(item.id)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                          >
                            View
                          </button>
                        </div>
                        {/* Always show icons on mobile toggle */}
                        <div className="flex md:hidden items-center gap-1">
                          <button onClick={() => setActiveModal(item.id)} className="p-2 text-primary"><FaPlus size={14} /></button>
                          <button onClick={() => setViewingData(item.id)} className="p-2 text-blue-600"><FaChevronRight size={14} /></button>
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
