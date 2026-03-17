import { useState } from "react";
import InventorySalesOrderEntry from "../../components/inventory/InventorySalesOrderEntry";
import InventorySalesOrderHeader from "../../components/inventory/InventorySalesOrderHeader";
import { useBranch } from "../../context/BranchContext";
import { useInventory } from "../../context/InventoryContext";

const BranchSalesOrder = () => {
  const { voucherTypes, productGroups, productCategories, products, warehouses, customers, salesMen, deliveryMen, salesOwners, customerGroups } = useInventory();
  const { currentBranch } = useBranch();

  const [items, setItems] = useState([]);

  const soVoucherTypes = voucherTypes.filter(
    (v) => v.orderType === "SO"
  );

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
          />
        </div>
      </div>
    </div>
  );
};

export default BranchSalesOrder;
