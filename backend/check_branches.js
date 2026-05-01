import mongoose from 'mongoose';
import Branch from './models/Branch.js';
import Invoice from './models/Invoice.js';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/pearl_v2")
  .then(async () => {
    const branches = await Branch.find();
    console.log("Branches:");
    branches.forEach(b => console.log(`${b.name} - ${b._id}`));
    
    const start = new Date("2026-04-01T00:00:00.000Z");
    const end = new Date("2026-04-01T23:59:59.999Z");
    
    // Find Pearl Agency id
    const pa = branches.find(b => b.name === "Pearl Agency");
    
    if (pa) {
      const invoices = await Invoice.find({
        invoiceDate: { $gte: start, $lte: end },
        branchId: pa._id,
        status: { $nin: ["DRAFT", "CANCELLED"] }
      }).select("invoiceNumber status grandTotal invoiceType customer.name");
      
      let total = 0;
      console.log(`\nInvoices for ${pa.name}:`);
      invoices.forEach(inv => {
        console.log(`${inv.invoiceNumber} | ${inv.customer.name} | ${inv.grandTotal}`);
        total += inv.grandTotal;
      });
      console.log(`TOTAL: ${total}`);
    }
    
    process.exit(0);
  });
