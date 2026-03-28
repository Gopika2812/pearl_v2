import Vendor from "../models/Vendor.js";

/**
 * Fix Vendor unique index
 * Drops old incorrect indexes (like name_1) and ensures the composite index is correct
 */
export const fixVendorIndex = async () => {
  try {
    console.log("🔧 Fixing Vendor indexes...");

    // Get all indexes
    const indexes = await Vendor.collection.getIndexes();
    console.log("📋 Current Vendor indexes:", Object.keys(indexes));

    // Drop old incorrect unique indexes (without branchId)
    const indexesToDrop = Object.keys(indexes).filter(
      (indexName) =>
        indexName === "name_1" || 
        (indexes[indexName].unique && !indexes[indexName].key.branchId && indexName !== "_id_")
    );

    if (indexesToDrop.length > 0) {
      for (const indexName of indexesToDrop) {
        console.log(`  Dropping old Vendor index: ${indexName}`);
        await Vendor.collection.dropIndex(indexName);
      }
    }

    // Ensure correct composite unique index
    await Vendor.collection.createIndex(
      { branchId: 1, name: 1 },
      { unique: true }
    );

    console.log("✅ Vendor indexes fixed successfully!");
    console.log("   New index: {branchId: 1, name: 1} - UNIQUE");
  } catch (err) {
    console.error("❌ Error fixing Vendor indexes:", err.message);
    // Don't throw here to avoid blocking server start, just log the error
  }
};

export default fixVendorIndex;
