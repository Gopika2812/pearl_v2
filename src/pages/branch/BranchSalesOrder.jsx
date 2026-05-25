import { useState } from "react";
import InventorySalesOrderEntry from "../../components/inventory/InventorySalesOrderEntry";
import InventorySalesOrderHeader from "../../components/inventory/InventorySalesOrderHeader";
import { useBranch } from "../../context/BranchContext";
import { useInventory } from "../../context/InventoryContext";
import TokenSidePanel from "../../components/inventory/TokenSidePanel";

const BranchSalesOrder = () => {
  const { voucherTypes, productGroups, productCategories, products, warehouses, customers, salesMen, deliveryMen, salesOwners, customerGroups, customerCategories } = useInventory();
  const { currentBranch, user } = useBranch();
  const [items, setItems] = useState([]);
  const [isDummyMode, setIsDummyMode] = useState(false);

  let soVoucherTypes = voucherTypes.filter((v) => v.orderType === "SO");
  
  // Apply granular voucher authorization (skip for Admins)
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  if (!isAdmin && user?.allowedVoucherTypes && user.allowedVoucherTypes.length > 0) {
    soVoucherTypes = soVoucherTypes.filter(v => user.allowedVoucherTypes.includes(v._id));
  }

  const canUseDummyBills = user?.role === "SUPER_ADMIN" || user?.actionPermissions?.allowDummyBills === true;

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20">
      <div className="w-full px-3 sm:px-6 py-4">
        <InventorySalesOrderHeader 
          title={isDummyMode ? "Dummy Sales Order" : "Sales Order"}
          description={isDummyMode ? "Create a dummy bill / sales order (does not affect stock or balances)." : "Create and manage customer sales orders and invoices."}
        >
          {canUseDummyBills && (
            <div className="relative">
              <select
                value={isDummyMode ? "dummy" : "regular"}
                onChange={(e) => setIsDummyMode(e.target.value === "dummy")}
                className="bg-white border-2 border-[#319bab]/20 focus:border-[#319bab] text-[#319bab] font-black text-[10px] px-4 py-2.5 rounded-xl outline-none shadow-sm transition-all cursor-pointer uppercase tracking-widest hover:bg-gray-50"
              >
                <option value="regular">Regular Bill</option>
                <option value="dummy">Dummy Bill</option>
              </select>
            </div>
          )}
        </InventorySalesOrderHeader>

        <div className="mt-5">
          <InventorySalesOrderEntry
            isDummyMode={isDummyMode}
            items={items}
            setItems={setItems}
            branchId={currentBranch?._id}
            voucherTypes={soVoucherTypes}
            productGroups={productGroups}
            products={products}
            warehouses={warehouses}
            customers={customers}
            salesMen={salesMen}
            deliveryMen={deliveryMen}
            salesOwners={salesOwners}
            customerGroups={customerGroups}
            customerCategories={customerCategories}
          />
        </div>
      </div>
      
      {/* Tokenization Integration */}
      <TokenSidePanel branchId={currentBranch?._id} user={user} />
    </div>
  );
};

export default BranchSalesOrder;
