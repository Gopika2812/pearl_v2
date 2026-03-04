import { useState } from "react";

import InventoryPurchaseOrderEntry from "../../components/inventory/InventoryPurchaseOrderEntry";
import InventoryPurchaseOrderHeader from "../../components/inventory/InventoryPurchaseOrderHeader";

import { useBranch } from "../../context/BranchContext";
import { useInventory } from "../../context/InventoryContext";

const BranchPO = () => {
  const {
    voucherTypes, productGroups, productCategories, products,
    warehouses, vendors, salesOwners, salesMen, deliveryMen, customerGroups
  } = useInventory();
  const { currentBranch } = useBranch();

  const [items, setItems] = useState([]);

  const poVoucherTypes = voucherTypes.filter(
    (v) => v.orderType === "PO"
  );

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-16 md:pl-64">
      <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 py-4">
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
              salesOwners={salesOwners}
              salesMen={salesMen}
              deliveryMen={deliveryMen}
              customerGroups={customerGroups}
            />
        </div>
      </div>
    </div>
  );
};

export default BranchPO;
