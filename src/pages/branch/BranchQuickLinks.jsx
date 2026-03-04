import { useState } from "react";
import { FaBars, FaChevronRight, FaLink, FaPlus, FaTimes } from "react-icons/fa";
import QuickLinksDataManager from "../../components/QuickLinksDataManager";
import { useBranch } from "../../context/BranchContext";
import { useInventory } from "../../context/InventoryContext";

// Import all modals from inventory components
import CustomerCategoryAddModal from "../../components/inventory/CustomerCategoryAddModal";
import CustomerGroupAddModal from "../../components/inventory/CustomerGroupAddModal";
import ExtraExpensesOrderModal from "../../components/inventory/ExtraExpensesOrderModal";
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
  const { productGroups, productCategories, customerCategories, customerGroups, warehouses, addData, updateData, addLocalVoucher, addLocalWarehouse, addLocalProductCategory, addLocalCustomerCategory, addLocalCustomerGroup, salesOwners } = useInventory();
  const { currentBranch } = useBranch();
  const [activeModal, setActiveModal] = useState(null);
  const [showQuickLinks, setShowQuickLinks] = useState(true);
  const [viewingData, setViewingData] = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  const branchId = currentBranch?._id;

  const actionBtnClass =
    "bg-gradient-to-br from-primary to-[#248d94] text-white py-3 px-4 rounded-xl font-bold text-sm uppercase shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 text-left flex items-center gap-2 flex-1";

  const quickLinksData = [
    { id: "voucher_type", label: "Voucher Type" },
    { id: "warehouse", label: "Warehouse" },
    { id: "product_group", label: "Product Group" },
    { id: "product_category", label: "Product Category" },
    { id: "product", label: "Product" },
    { id: "customer_category", label: "Customer Category" },
    { id: "customer_group", label: "Customer Group" },
    { id: "customer", label: "Customer" },
    { id: "vendor", label: "Vendor" },
    { id: "sales_owner", label: "Sales Owner" },
    { id: "sales_man", label: " Sales Man" },
    { id: "delivery_man", label: " Delivery Man" },
    { id: "extra_expenses_order", label: "💰 Extra Expenses Order" },
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
            className={`fixed left-0 top-20 md:top-16 h-[calc(100vh-80px)] md:h-[calc(100vh-64px)] w-80 bg-gradient-to-b from-gray-50 to-white shadow-2xl z-50 transform transition-transform duration-300 lg:static lg:top-0 lg:h-fit lg:w-80 lg:rounded-2xl lg:bg-gradient-to-b from-gray-50 to-white lg:shadow-lg lg:transform-none lg:transition-none overflow-y-auto lg:overflow-visible ${
              showQuickLinks ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
            }`}
          >
            <div className="bg-gradient-to-r from-primary to-[#248d94] text-white p-5 font-bold flex justify-between items-center sticky top-0 shadow-md rounded-b-lg">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚡</span>
                <span>{viewingData ? "View Data" : "Quick Actions"}</span>
              </div>
              <button
                onClick={() => setShowQuickLinks(false)}
                className="lg:hidden text-white text-xl hover:bg-white/20 p-2 rounded-lg transition"
              >
                <FaTimes />
              </button>
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-3 p-5 max-h-[calc(100vh-160px)] overflow-y-auto">
              {quickLinksData.map((link) => (
                <div key={link.id} className="group">
                  <div className="flex gap-2 items-center">
                    <button
                      onClick={() => {
                        setActiveModal(link.id);
                        setShowQuickLinks(false);
                      }}
                      className={actionBtnClass}
                    >
                      <FaPlus size={14} /> {link.label}
                    </button>
                    {link.id !== "extra_expenses_order" && (
                      <button
                        onClick={() => setViewingData(link.id)}
                        className="bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 py-3 rounded-xl font-bold shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
                        title="View Data"
                      >
                        <FaChevronRight size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Info Box */}
            <div className="p-5 mt-auto border-t border-gray-200">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-l-4 border-blue-500 rounded-lg p-4 shadow-md">
                <p className="text-gray-700 text-sm leading-relaxed">
                  <span className="font-bold text-blue-700">💡 Quick Tip:</span> Click the <strong>+</strong> button to create new records, or the <strong>→</strong> button to view existing data.
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
              <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg p-10 space-y-8">
                <div className="border-b-2 border-gray-200 pb-6">
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">🎯 Master Data Management</h2>
                  <p className="text-gray-600 leading-relaxed">
                    Click the <span className="font-semibold text-primary">+</span> buttons on the left to quickly create and manage system master data. Use the <span className="font-semibold text-blue-600">→</span> buttons to view existing records.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="border-l-4 border-primary pl-5 py-3 bg-gradient-to-r from-primary/5 to-transparent rounded-r-lg hover:shadow-md transition-all duration-200">
                    <h3 className="font-bold text-gray-900 text-lg">📋 Voucher Types</h3>
                    <p className="text-sm text-gray-600 mt-1">Create PO and SO voucher types for billing</p>
                  </div>

                  <div className="border-l-4 border-blue-500 pl-5 py-3 bg-gradient-to-r from-blue-500/5 to-transparent rounded-r-lg hover:shadow-md transition-all duration-200">
                    <h3 className="font-bold text-gray-900 text-lg">🏭 Warehouses</h3>
                    <p className="text-sm text-gray-600 mt-1">Add and manage warehouse locations</p>
                  </div>

                  <div className="border-l-4 border-green-500 pl-5 py-3 bg-gradient-to-r from-green-500/5 to-transparent rounded-r-lg hover:shadow-md transition-all duration-200">
                    <h3 className="font-bold text-gray-900 text-lg">📦 Product Groups</h3>
                    <p className="text-sm text-gray-600 mt-1">Create product categories with bulk upload support</p>
                  </div>

                  <div className="border-l-4 border-emerald-500 pl-5 py-3 bg-gradient-to-r from-emerald-500/5 to-transparent rounded-r-lg hover:shadow-md transition-all duration-200">
                    <h3 className="font-bold text-gray-900 text-lg">🏷️ Product Categories</h3>
                    <p className="text-sm text-gray-600 mt-1">Create product sub-categories with organization</p>
                  </div>

                  <div className="border-l-4 border-orange-500 pl-5 py-3 bg-gradient-to-r from-orange-500/5 to-transparent rounded-r-lg hover:shadow-md transition-all duration-200">
                    <h3 className="font-bold text-gray-900 text-lg">📝 Products</h3>
                    <p className="text-sm text-gray-600 mt-1">Add products with pricing, GST, and bulk upload</p>
                  </div>

                  <div className="border-l-4 border-cyan-500 pl-5 py-3 bg-gradient-to-r from-cyan-500/5 to-transparent rounded-r-lg hover:shadow-md transition-all duration-200">
                    <h3 className="font-bold text-gray-900 text-lg">👤 Customer Categories</h3>
                    <p className="text-sm text-gray-600 mt-1">Create customer segments (Retail, Wholesale, Corporate, etc.)</p>
                  </div>

                  <div className="border-l-4 border-red-500 pl-5 py-3 bg-gradient-to-r from-red-500/5 to-transparent rounded-r-lg hover:shadow-md transition-all duration-200">
                    <h3 className="font-bold text-gray-900 text-lg">👥 Customers</h3>
                    <p className="text-sm text-gray-600 mt-1">Add customer records with contact details and category assignment</p>
                  </div>

                  <div className="border-l-4 border-purple-500 pl-5 py-3 bg-gradient-to-r from-purple-500/5 to-transparent rounded-r-lg hover:shadow-md transition-all duration-200">
                    <h3 className="font-bold text-gray-900 text-lg">🏢 Vendors</h3>
                    <p className="text-sm text-gray-600 mt-1">Create vendor records with GSTIN and bulk upload support</p>
                  </div>

                  <div className="border-l-4 border-pink-500 pl-5 py-3 bg-gradient-to-r from-pink-500/5 to-transparent rounded-r-lg hover:shadow-md transition-all duration-200">
                    <h3 className="font-bold text-gray-900 text-lg">👔 Sales Owners</h3>
                    <p className="text-sm text-gray-600 mt-1">Add sales owner profiles and contact information</p>
                  </div>

                  <div className="border-l-4 border-indigo-500 pl-5 py-3 bg-gradient-to-r from-indigo-500/5 to-transparent rounded-r-lg hover:shadow-md transition-all duration-200">
                    <h3 className="font-bold text-gray-900 text-lg">🎯 Sales Men</h3>
                    <p className="text-sm text-gray-600 mt-1">Create sales representative records with commissions</p>
                  </div>

                  <div className="border-l-4 border-teal-500 pl-5 py-3 bg-gradient-to-r from-teal-500/5 to-transparent rounded-r-lg hover:shadow-md transition-all duration-200">
                    <h3 className="font-bold text-gray-900 text-lg">🚚 Delivery Men</h3>
                    <p className="text-sm text-gray-600 mt-1">Add delivery personnel with vehicle information</p>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 rounded-lg p-5 shadow-sm">
                  <p className="text-sm text-gray-700 leading-relaxed">
                    <span className="font-bold text-green-700">✨ Excel Bulk Upload:</span> Products, Customers, and Vendors support fast bulk upload via Excel files. Perfect for importing large datasets at once.
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

      <ExtraExpensesOrderModal
        isOpen={activeModal === "extra_expenses_order"}
        onClose={() => { setActiveModal(null); setEditingItem(null); }}
        onSuccess={() => {}}
      />
    </div>
  );
}
