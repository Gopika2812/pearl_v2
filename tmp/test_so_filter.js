import mongoose from "mongoose";
import SalesOrder from "./backend/models/SalesOrder.js";
import "./backend/config/env.js"; // Ensure env vars are loaded

async function testFilter() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const testCustomer = "Test Customer"; // Replace with a real customer name if needed
  
  const results = await SalesOrder.find({
    "customer.name": { $regex: testCustomer, $options: "i" },
    status: "INVOICED"
  }).limit(5);

  console.log(`Found ${results.length} invoiced orders for ${testCustomer}`);
  results.forEach(r => console.log(`- ${r.invoiceId} (${r.status})`));

  await mongoose.disconnect();
}

testFilter().catch(console.error);
