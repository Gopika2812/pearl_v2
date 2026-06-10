import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://gopikap2812_db_user:3EprufLKuDVKIdo3@branchesdb.njfcfju.mongodb.net/pearls_erp?retryWrites=true&w=majority";

const SalesOrderSchema = new mongoose.Schema({
  invoiceId: String,
  items: [
    {
      name: String,
      batch: String,
      expiryDate: Date,
      qty: Number
    }
  ]
}, { collection: 'salesorders' });

const SalesOrder = mongoose.model('SalesOrder', SalesOrderSchema);

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB!");
  
  const order = await SalesOrder.findOne({ invoiceId: "Z1SO/088/26-27" }).lean();
  console.log("ORDER FOUND:", JSON.stringify(order, null, 2));
  
  await mongoose.disconnect();
}

main().catch(console.error);
