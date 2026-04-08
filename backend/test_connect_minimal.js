import mongoose from "mongoose";
import dns from "dns";

console.log("🚀 Script started");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
console.log("✅ DNS set");

const uri = "mongodb+srv://gopikap2812_db_user:3EprufLKuDVKIdo3@branchesdb.njfcfju.mongodb.net/pearls_erp?retryWrites=true&w=majority";

async function test() {
  try {
    console.log("📡 Connecting...");
    await mongoose.connect(uri);
    console.log("✅ Connected!");
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log("Collections:", collections.map(c => c.name));
    process.exit(0);
  } catch (err) {
    console.error("❌ Connection failed!", err);
    process.exit(1);
  }
}

test();
