import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ MONGO_URI not found in .env file");
  process.exit(1);
}

async function resetDatabase() {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const db = mongoose.connection.db;
    console.log("\n🗑️  Dropping all collections...");

    const collections = await db.listCollections().toArray();
    
    for (const collection of collections) {
      await db.dropCollection(collection.name);
      console.log(`   ✅ Dropped: ${collection.name}`);
    }

    console.log("\n✅ Database completely reset!");
    console.log("📝 All collections have been deleted.");
    console.log("🚀 You can now start fresh with a clean database.\n");

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error resetting database:", error.message);
    process.exit(1);
  }
}

resetDatabase();
