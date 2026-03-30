import PurchaseInvoice from "../models/PurchaseInvoice.js";

/**
 * Fix PurchaseInvoice unique index
 * Drops the old global purchaseInvoiceId_1 index
 * and creates a compound branchId+purchaseInvoiceId index
 */
export const fixPurchaseInvoiceIndex = async () => {
  try {
    console.log("🔧 Fixing PurchaseInvoice indexes...");

    const indexes = await PurchaseInvoice.collection.getIndexes();
    console.log("📋 Current PI indexes:", Object.keys(indexes));

    // Drop the old global unique purchaseInvoiceId index if it exists
    const indexesToDrop = Object.keys(indexes).filter(
      (indexName) =>
        indexName === "purchaseInvoiceId_1" ||
        (indexes[indexName].unique &&
          indexes[indexName].key.purchaseInvoiceId &&
          !indexes[indexName].key.branchId)
    );

    if (indexesToDrop.length > 0) {
      for (const indexName of indexesToDrop) {
        console.log(`  Dropping old global index: ${indexName}`);
        await PurchaseInvoice.collection.dropIndex(indexName);
      }
    } else {
      console.log("  No old global purchaseInvoiceId index found.");
    }

    // Ensure the correct compound index exists
    await PurchaseInvoice.collection.createIndex(
      { branchId: 1, purchaseInvoiceId: 1 },
      { unique: true, name: "branchId_1_purchaseInvoiceId_1" }
    );

    console.log("✅ PurchaseInvoice indexes fixed!");
    console.log("   New index: {branchId: 1, purchaseInvoiceId: 1} - UNIQUE");
  } catch (err) {
    console.error("❌ Error fixing PurchaseInvoice indexes:", err.message);
    // Don't throw - allow server to still start
  }
};

export default fixPurchaseInvoiceIndex;
