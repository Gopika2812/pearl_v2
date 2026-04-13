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

  let soVoucherTypes = voucherTypes.filter((v) => v.orderType === "SO");
  
  // Apply granular voucher authorization (skip for Admins)
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  if (!isAdmin && user?.allowedVoucherTypes && user.allowedVoucherTypes.length > 0) {
    soVoucherTypes = soVoucherTypes.filter(v => user.allowedVoucherTypes.includes(v._id));
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20">
      <div className="w-full px-3 sm:px-6 py-4">
        <InventorySalesOrderHeader title="Sales Order" />

        <div className="mt-5">
          <InventorySalesOrderEntry
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
