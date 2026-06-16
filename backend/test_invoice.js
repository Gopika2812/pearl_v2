import "./config/env.js";
import mongoose from "mongoose";
import Invoice from "./models/Invoice.js";

async function checkInvoice() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB");
    
    const inv = await Invoice.findOne({ invoiceNumber: "LESI/510/26-27" });
    if (inv) {
      console.log("Invoice Found:");
      console.log("- Status:", inv.status);
      console.log("- Branch ID:", inv.branchId);
      console.log("- Customer ID:", inv.customer.customerId);
      console.log("- Is Spotted:", inv.isSpottedCustomer);
      console.log("- Payment Mode:", inv.paymentMode);
    } else {
      console.log("Invoice LESI/510/26-27 not found!");
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

checkInvoice();
