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
  const { currentBranch, user } = useBranch();

  const [items, setItems] = useState([]);

  let poVoucherTypes = voucherTypes.filter((v) => v.orderType === "PO");

  // Apply granular voucher authorization
  if (user?.allowedVoucherTypes && user.allowedVoucherTypes.length > 0) {
    poVoucherTypes = poVoucherTypes.filter(v => user.allowedVoucherTypes.includes(v._id));
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20">
      <div className="w-full px-3 sm:px-6 py-4">
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
