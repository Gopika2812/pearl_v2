import Token from "../models/Token.js";

/**
 * Fix Token unique index
 * Ensures that tokenId is unique PER branch, not globally.
 */
export const fixTokenIndex = async () => {
  try {
    console.log("🔧 Fixing Token indexes...");

    // Get all indexes
    const indexes = await Token.collection.getIndexes();
    console.log("📋 Current Token indexes:", Object.keys(indexes));

    // Drop old incorrect unique indexes (without branchId)
    // We want to drop 'tokenId_1' if it's unique but doesn't include branchId
    const indexesToDrop = Object.keys(indexes).filter(
      (indexName) =>
        indexName === "tokenId_1" || 
        (indexes[indexName].unique && !indexes[indexName].key.branchId && indexName !== "_id_")
    );

    if (indexesToDrop.length > 0) {
      for (const indexName of indexesToDrop) {
        console.log(`  Dropping old Token index: ${indexName}`);
        await Token.collection.dropIndex(indexName);
      }
    }

    // Ensure correct composite unique index
    await Token.collection.createIndex(
      { tokenId: 1, branchId: 1 },
      { unique: true }
    );

    console.log("✅ Token indexes fixed successfully!");
    console.log("   New index: {tokenId: 1, branchId: 1} - UNIQUE");
  } catch (err) {
    console.error("❌ Error fixing Token indexes:", err.message);
  }
};

export default fixTokenIndex;
