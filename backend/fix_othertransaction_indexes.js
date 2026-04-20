import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://gopikap2812_db_user:3EprufLKuDVKIdo3@branchesdb.njfcfju.mongodb.net/pearls_erp?retryWrites=true&w=majority";

async function fixIndexes() {
    try {
        console.log("🔌 Connecting to MongoDB for index cleanup...");
        await mongoose.connect(MONGO_URI);
        console.log("✅ Connected");

        const db = mongoose.connection.db;
        const collection = db.collection('othertransactions');

        console.log("🔍 Checking existing indexes for 'othertransactions'...");
        const indexes = await collection.indexes();
        console.log("Current indexes:", indexes.map(i => i.name));

        if (indexes.some(i => i.name === "transactionId_1")) {
            console.log("🗑️  Dropping old global unique index 'transactionId_1'...");
            await collection.dropIndex("transactionId_1");
            console.log("✅ Dropped successfully");
        } else {
            console.log("ℹ️  Old index 'transactionId_1' not found.");
        }

        console.log("🚀 Index cleanup complete. Mongoose will now recreate the correct composite index on next server restart.");
        await mongoose.connection.close();
        process.exit(0);
    } catch (err) {
        console.error("❌ Error fixing indexes:", err);
        process.exit(1);
    }
}

fixIndexes();
