import mongoose from "mongoose";
import dotenv from "dotenv";
import SalesOrder from "../models/SalesOrder.js";

dotenv.config();

async function check() {
  try {
    const uri = process.env.MONGO_URI;
    await mongoose.connect(uri);
    
    console.log("🔍 Checking for RE_INVOICED history entries after April 9...");
    const orders = await SalesOrder.find({
      "editHistory.editType": "RE_INVOICED",
      "editHistory.editedAt": { $gte: new Date("2026-04-10") }
    }).lean();

    console.log(`📊 Found ${orders.length} orders with Re-Invoice history after April 9.`);
    
    orders.forEach(so => {
      const reInvoices = so.editHistory.filter(h => h.editType === "RE_INVOICED" && h.editedAt >= new Date("2026-04-10"));
      reInvoices.forEach(h => {
        console.log(`Order: ${so.invoiceId} | Date: ${h.editedAt} | Version: ${h.version}`);
      });
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
