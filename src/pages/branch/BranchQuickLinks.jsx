import { useState } from "react";
import { FaBars, FaChevronRight, FaLink, FaPlus, FaTimes } from "react-icons/fa";
import QuickLinksDataManager from "../../components/QuickLinksDataManager";
import { useBranch } from "../../context/BranchContext";
import { useInventory } from "../../context/InventoryContext";

// Import all modals from inventory components
import CustomerCategoryAddModal from "../../components/inventory/CustomerCategoryAddModal";
import InventoryAddCustomerModal from "../../components/inventory/InventoryAddCustomerModal";
import InventoryAddDeliveryManModal from "../../components/inventory/InventoryAddDeliveryManModal";
import InventoryAddProductCategoryModal from "../../components/inventory/InventoryAddProductCategoryModal";
import InventoryAddProductGroupModal from "../../components/inventory/InventoryAddProductGroupModal";
import InventoryAddProductModal from "../../components/inventory/InventoryAddProductModal";
import InventoryAddSalesManModal from "../../components/inventory/InventoryAddSalesManModal";
import InventoryAddSalesOwnerModal from "../../components/inventory/InventoryAddSalesOwnerModal";
import InventoryAddVendorModal from "../../components/inventory/InventoryAddVendorModal";
import InventoryAddVoucherTypeModal from "../../components/inventory/InventoryAddVoucherTypeModal";
import InventoryAddWarehouseModal from "../../components/inventory/InventoryAddWarehouseModal";

export default function BranchQuickLinks() {
  const { productGroups, productCategories, customerCategories, warehouses, addData, addLocalVoucher, addLocalWarehouse, addLocalProductCategory, addLocalCustomerCategory, salesOwners } = useInventory();
  const { currentBranch } = useBranch();
  const [activeModal, setActiveModal] = useState(null);
  const [showQuickLinks, setShowQuickLinks] = useState(true);
  const [viewingData, setViewingData] = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  const branchId = currentBranch?._id;

  const actionBtnClass =
    "bg-primary text-white py-3 px-4 rounded-xl font-bold text-sm uppercase shadow hover:bg-[#248d94] transition text-left flex items-center gap-2 flex-1";

  const quickLinksData = [
    { id: "voucher_type", label: "Voucher Type" },
    { id: "warehouse", label: "Warehouse" },
    { id: "product_group", label: "Product Group" },
    { id: "product_category", label: "Product Category" },
    { id: "product", label: "Product" },
    { id: "customer_category", label: "Customer Category" },
    { id: "customer", label: "Customer" },
    { id: "vendor", label: "Vendor" },
    { id: "sales_owner", label: "Sales Owner" },
    { id: "sales_man", label: " Sales Man" },
    { id: "delivery_man", label: " Delivery Man" },
  ];

  const handleAddData = (type, data) => {
    // Add branchId to the data object
    const dataWithBranch = { ...data, branchId };
    addData(type, dataWithBranch);
    setActiveModal(null);
  };

  return (
    <div className="min-h-screen bg-gray-100 pt-20 md:pt-16 md:pl-64 px-4 md:px-6 pb-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-secondary to-primary text-white rounded-2xl shadow-lg p-8 mb-8 relative">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <FaLink className="text-5xl opacity-80" />
              <div>
                <h1 className="text-4xl font-bold">Quick Links </h1>
                <p className="text-blue-100 mt-2">Create and manage master data instantly</p>
              </div>
            </div>
            {/* Mobile Menu Button */}
            <button
              onClick={() => setShowQuickLinks(true)}
              className="lg:hidden bg-white text-primary p-3 rounded-lg shadow-lg hover:bg-blue-50 transition"
              title="Open Quick Links"
            >
              <FaBars size={24} />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex gap-6 relative">
          {/* Sidebar Modal Overlay (Mobile/Tablet) */}
          {showQuickLinks && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 lg:hidden z-40"
              onClick={() => setShowQuickLinks(false)}
            />
          )}

          {/* Left - Quick Links Sidebar Modal */}
          <div
            className={`fixed left-0 top-20 md:top-16 h-[calc(100vh-80px)] md:h-[calc(100vh-64px)] w-80 bg-white shadow-2xl z-50 transform transition-transform duration-300 lg:static lg:top-0 lg:h-fit lg:w-80 lg:rounded-2xl lg:bg-white lg:shadow-lg lg:transform-none lg:transition-none overflow-y-auto lg:overflow-visible ${
              showQuickLinks ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
            }`}
          >
            <div className="bg-primary text-white p-4 font-bold flex justify-between items-center sticky top-0">
              <span>{viewingData ? "View Data" : "Quick Actions"}</span>
              <button
                onClick={() => setShowQuickLinks(false)}
                className="lg:hidden text-white text-xl hover:bg-[#248d94] p-2 rounded-lg transition"
              >
                <FaTimes />
              </button>
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-2 p-4 max-h-[calc(100vh-140px)] overflow-y-auto">
              {quickLinksData.map((link) => (
                <div key={link.id} className="flex gap-2">
                  <button
                    onClick={() => {
                      setActiveModal(link.id);
                      setShowQuickLinks(false);
                    }}
                    className={actionBtnClass}
                  >
                    <FaPlus size={14} /> {link.label}
                  </button>
                  <button
                    onClick={() => setViewingData(link.id)}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-xl font-bold shadow transition"
                    title="View Data"
                  >
                    <FaChevronRight size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Info Box */}
            <div className="p-4">
              <div className="bg-blue-50 border-l-4 border-primary rounded-lg p-4">
                <p className="text-gray-700 text-sm">
                  <span className="font-bold text-primary">💡 Tip:</span> Click any button to quickly create master data records.
                </p>
              </div>
            </div>
          </div>

          {/* Right - Info Section */}
          <div className="hidden lg:block flex-1">
            {viewingData ? (
              <div className="bg-white rounded-2xl shadow-lg p-8">
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
              <div className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Master Data Management</h2>
                  <p className="text-gray-600 mb-4">
                    Use the quick action buttons on the left to quickly create and manage the following master data:
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="border-l-4 border-primary pl-4">
                    <h3 className="font-bold text-gray-900">📋 Voucher Types</h3>
                    <p className="text-sm text-gray-600">Create PO and SO voucher types for billing</p>
                  </div>

                  <div className="border-l-4 border-blue-500 pl-4">
                    <h3 className="font-bold text-gray-900">🏭 Warehouses</h3>
                    <p className="text-sm text-gray-600">Add and manage warehouse locations</p>
                  </div>

                  <div className="border-l-4 border-green-500 pl-4">
                    <h3 className="font-bold text-gray-900">📦 Product Groups</h3>
                    <p className="text-sm text-gray-600">Create product categories with bulk upload support</p>
                  </div>

                  <div className="border-l-4 border-emerald-500 pl-4">
                    <h3 className="font-bold text-gray-900">🏷️ Product Categories</h3>
                    <p className="text-sm text-gray-600">Create product categories with bulk upload support</p>
                  </div>

                  <div className="border-l-4 border-orange-500 pl-4">
                    <h3 className="font-bold text-gray-900">📝 Products</h3>
                    <p className="text-sm text-gray-600">Add products with pricing, GST, and bulk upload</p>
                  </div>

                  <div className="border-l-4 border-cyan-500 pl-4">
                    <h3 className="font-bold text-gray-900">👤 Customer Categories</h3>
                    <p className="text-sm text-gray-600">Create customer categories (Retail, Wholesale, Corporate, etc.)</p>
                  </div>

                  <div className="border-l-4 border-red-500 pl-4">
                    <h3 className="font-bold text-gray-900">👥 Customers</h3>
                    <p className="text-sm text-gray-600">Add customer records with contact details and category assignment</p>
                  </div>

                  <div className="border-l-4 border-purple-500 pl-4">
                    <h3 className="font-bold text-gray-900">🏢 Vendors</h3>
                    <p className="text-sm text-gray-600">Create vendor records with GSTIN</p>
                  </div>

                  <div className="border-l-4 border-pink-500 pl-4">
                    <h3 className="font-bold text-gray-900">👔 Sales Owners</h3>
                    <p className="text-sm text-gray-600">Add sales owner profiles</p>
                  </div>

                  <div className="border-l-4 border-indigo-500 pl-4">
                    <h3 className="font-bold text-gray-900">🎯 Sales Men</h3>
                    <p className="text-sm text-gray-600">Create sales representative records</p>
                  </div>

                  <div className="border-l-4 border-teal-500 pl-4">
                    <h3 className="font-bold text-gray-900">🚚 Delivery Men</h3>
                    <p className="text-sm text-gray-600">Add delivery personnel information</p>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-gray-700">
                    <span className="font-bold text-green-700">✨ Excel Bulk Upload:</span> Product Groups and Products support bulk upload via Excel files for faster data entry.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
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

      <InventoryAddCustomerModal
        isOpen={activeModal === "customer"}
        onClose={() => { setActiveModal(null); setEditingItem(null); }}
        onSave={(data) => { handleAddData("customer", data); setEditingItem(null); }}
        salesOwners={salesOwners}
        customerCategories={customerCategories}
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
