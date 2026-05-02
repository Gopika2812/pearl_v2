import mongoose from 'mongoose';
import Invoice from './backend/models/Invoice.js';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/pearl_v2")
  .then(async () => {
    const start = new Date("2026-04-01T00:00:00.000Z");
    const end = new Date("2026-04-01T23:59:59.999Z");
    
    const invoices = await Invoice.find({
      invoiceDate: { $gte: start, $lte: end }
    }).select("invoiceNumber status grandTotal invoiceType customer.name");
    
    let totalAll = 0;
    let totalNonDraft = 0;
    
    console.log("ALL INVOICES ON APRIL 1st:");
    invoices.forEach(inv => {
      console.log(`${inv.invoiceNumber} | ${inv.customer.name} | ${inv.grandTotal} | ${inv.status} | ${inv.invoiceType}`);
      totalAll += inv.grandTotal;
      if (inv.status !== "DRAFT" && inv.status !== "CANCELLED") {
        totalNonDraft += inv.grandTotal;
      }
    });
    
    console.log("-------------------");
    console.log(`Total ALL: ${totalAll}`);
    console.log(`Total Non-Draft/Cancelled: ${totalNonDraft}`);
    
    process.exit(0);
  });
