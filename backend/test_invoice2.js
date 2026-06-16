import "./config/env.js";
import mongoose from "mongoose";
import Invoice from "./models/Invoice.js";

async function checkInvoice() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const invs = await Invoice.find({ invoiceNumber: { $in: ["LESI/500/26-27", "LESI/501/26-27"] } });
    for (const inv of invs) {
      console.log("\nInvoice:", inv.invoiceNumber);
      console.log("- Status:", inv.status);
      console.log("- Invoice Date:", inv.invoiceDate);
      console.log("- Created At:", inv.createdAt);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

checkInvoice();
