import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

// Register the Product model
import "../models/Product.js";

const connStr = process.env.MONGO_URI || "mongodb://localhost:27017/pearl-erp";

async function run() {
  console.log("Connecting to database...");
  await mongoose.connect(connStr);
  
  const Product = mongoose.model("Product");

  console.log("Resetting batches array to Batch 0 for all products using raw collection...");

  const result = await Product.collection.updateMany(
    {},
    [
      {
        $set: {
          batches: [
            {
              batchNo: "0",
              qty: { $ifNull: [ "$batch1.qty", 0 ] },
              expiryDate: { $ifNull: [ "$batch1.expiryDate", null ] },
              mrp: { $ifNull: [ "$batch1.mrp", 0 ] },
              manufacturingDate: { $ifNull: [ "$batch1.manufacturingDate", null ] }
            }
          ],
          totalQty: { $ifNull: [ "$batch1.qty", 0 ] }
        }
      }
    ]
  );

  console.log(`Successfully reset batches array to Batch 0 for ${result.modifiedCount} products.`);

  await mongoose.connection.close();
  console.log("Database connection closed.");
}

run().catch(console.error);
