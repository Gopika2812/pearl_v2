import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

import AuditLog from "./models/AuditLog.js";
import Invoice from "./models/Invoice.js";
import Customer from "./models/Customer.js";

async function recoverGstins() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");

    const logs = await AuditLog.find({ action: "CONVERT_TO_B2C" });
    console.log(`Found ${logs.length} CONVERT_TO_B2C logs.`);

    let recoveredCount = 0;

    for (const log of logs) {
      const match = log.description.match(/Removed GSTIN:\s*([A-Za-z0-9]+)/);
      if (match && match[1]) {
        const oldGstin = match[1];
        
        // Find the invoice to get the customer ID
        const invoice = await Invoice.findById(log.targetId);
        if (invoice && invoice.customer && invoice.customer.customerId) {
          const customer = await Customer.findById(invoice.customer.customerId);
          
          // Only update if current GSTIN is empty
          if (customer && (!customer.gstin || customer.gstin.trim() === "")) {
            customer.gstin = oldGstin;
            customer.registrationType = "regular";
            await customer.save();
            console.log(`✅ Recovered GSTIN ${oldGstin} for customer ${customer.name}`);
            recoveredCount++;
          } else {
            console.log(`⏭️ Skipped (already has GSTIN or not found): Invoice ${invoice.invoiceNumber}`);
          }
        }
      }
    }

    console.log(`\n🎉 Total GSTINs successfully recovered: ${recoveredCount}`);
    process.exit(0);
  } catch (error) {
    console.error("Error recovering GSTINs:", error);
    process.exit(1);
  }
}

recoverGstins();
