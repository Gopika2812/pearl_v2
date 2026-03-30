import PurchaseOrder from "../models/PurchaseOrder.js";

/**
 * Fix PurchaseOrder unique index
 * Drops the old global invoiceId_1 index and creates a compound branchId+invoiceId index
 */
export const fixPurchaseOrderIndex = async () => {
  try {
    console.log("🔧 Fixing PurchaseOrder indexes...");

    const indexes = await PurchaseOrder.collection.getIndexes();
    console.log("📋 Current PO indexes:", Object.keys(indexes));

    // Drop the old global unique invoiceId index if it exists
    const indexesToDrop = Object.keys(indexes).filter(
      (indexName) =>
        indexName === "invoiceId_1" ||
        (indexes[indexName].unique &&
          indexes[indexName].key.invoiceId &&
          !indexes[indexName].key.branchId)
    );

    if (indexesToDrop.length > 0) {
      for (const indexName of indexesToDrop) {
        console.log(`  Dropping old global index: ${indexName}`);
        await PurchaseOrder.collection.dropIndex(indexName);
      }
    } else {
      console.log("  No old global invoiceId index found.");
    }

    // Ensure the correct compound index exists (branchId + invoiceId)
    await PurchaseOrder.collection.createIndex(
      { branchId: 1, invoiceId: 1 },
      { unique: true, name: "branchId_1_invoiceId_1" }
    );

    console.log("✅ PurchaseOrder indexes fixed successfully!");
    console.log("   New index: {branchId: 1, invoiceId: 1} - UNIQUE");
  } catch (err) {
    console.error("❌ Error fixing PurchaseOrder indexes:", err.message);
    // Don't throw - allow server to still start
  }
};

export default fixPurchaseOrderIndex;
