import VoucherType from "../models/VoucherType.js";

/**
 * Fix VoucherType unique index
 * Drops old incorrect indexes and recreates the correct composite index
 */
export const fixVoucherTypeIndex = async () => {
  try {
    console.log("🔧 Fixing VoucherType indexes...");

    // Get all indexes
    const indexes = await VoucherType.collection.getIndexes();
    console.log("📋 Current indexes:", Object.keys(indexes));

    // Drop old incorrect unique indexes (without branchId)
    const indexesToDrop = Object.keys(indexes).filter(
      (indexName) =>
        indexName.includes("name_1_orderType_1") ||
        (indexes[indexName].unique && !indexes[indexName].key.branchId)
    );

    if (indexesToDrop.length > 0) {
      for (const indexName of indexesToDrop) {
        console.log(`  Dropping old index: ${indexName}`);
        await VoucherType.collection.dropIndex(indexName);
      }
    }

    // Create correct composite unique index
    await VoucherType.collection.createIndex(
      { branchId: 1, name: 1, orderType: 1 },
      { unique: true }
    );

    console.log("✅ VoucherType indexes fixed successfully!");
    console.log(
      "   New index: {branchId: 1, name: 1, orderType: 1} - UNIQUE"
    );
  } catch (err) {
    console.error("❌ Error fixing VoucherType indexes:", err.message);
    throw err;
  }
};

export default fixVoucherTypeIndex;
