import SalesOrder from "../models/SalesOrder.js";

/**
 * Fix SalesOrder unique index
 * Drops the old global invoiceId_1 index
 * and creates a compound branchId+invoiceId index
 */
export const fixSalesOrderIndex = async () => {
  try {
    console.log("🔧 Fixing SalesOrder indexes...");

    const indexes = await SalesOrder.collection.getIndexes();
    console.log("📋 Current SO indexes:", Object.keys(indexes));

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
        await SalesOrder.collection.dropIndex(indexName);
      }
    } else {
      console.log("  No old global SO invoiceId index found.");
    }

    // Ensure the correct compound index exists
    await SalesOrder.collection.createIndex(
      { branchId: 1, invoiceId: 1 },
      { unique: true, name: "branchId_1_invoiceId_1" }
    );

    console.log("✅ SalesOrder indexes fixed!");
    console.log("   New index: {branchId: 1, invoiceId: 1} - UNIQUE");
  } catch (err) {
    console.error("❌ Error fixing SalesOrder indexes:", err.message);
  }
};

export default fixSalesOrderIndex;
