import Invoice from "../models/Invoice.js";

/**
 * Fix Invoice (Sales Invoice) unique index
 * Drops the old global invoiceNumber_1 index
 * and creates a compound branchId+invoiceNumber index
 */
export const fixInvoiceIndex = async () => {
  try {
    console.log("🔧 Fixing Invoice indexes...");

    const indexes = await Invoice.collection.getIndexes();
    console.log("📋 Current SI indexes:", Object.keys(indexes));

    // Drop the old global unique invoiceNumber index if it exists
    const indexesToDrop = Object.keys(indexes).filter(
      (indexName) =>
        indexName === "invoiceNumber_1" ||
        (indexes[indexName].unique &&
          indexes[indexName].key.invoiceNumber &&
          !indexes[indexName].key.branchId)
    );

    if (indexesToDrop.length > 0) {
      for (const indexName of indexesToDrop) {
        console.log(`  Dropping old global index: ${indexName}`);
        await Invoice.collection.dropIndex(indexName);
      }
    } else {
      console.log("  No old global SI invoiceNumber index found.");
    }

    // Ensure the correct compound index exists
    await Invoice.collection.createIndex(
      { branchId: 1, invoiceNumber: 1 },
      { unique: true, name: "branchId_1_invoiceNumber_1" }
    );

    console.log("✅ Invoice indexes fixed!");
    console.log("   New index: {branchId: 1, invoiceNumber: 1} - UNIQUE");
  } catch (err) {
    console.error("❌ Error fixing Invoice indexes:", err.message);
  }
};

export default fixInvoiceIndex;
