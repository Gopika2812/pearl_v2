import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Invoice from './backend/models/Invoice.js';

dotenv.config({ path: './backend/.env' });

async function findInvoice() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to DB");

  // Find latest invoice with grandTotal 5651
  const invoice = await Invoice.findOne({ grandTotal: 5651 }).sort({ createdAt: -1 });

  if (!invoice) {
    console.log("Invoice not found with total 5651");
    process.exit(1);
  }

  console.log("\n=== INVOICE DETAILS ===");
  console.log("Invoice ID:", invoice.invoiceNumber);
  console.log("Grand Total:", invoice.grandTotal);
  console.log("Subtotal:", invoice.subtotal);
  console.log("Total Tax:", JSON.stringify(invoice.totalTax));
  console.log("Extra Exp Amt:", invoice.extraExpenseAmount);
  console.log("Transport:", invoice.transportCharge);
  console.log("Comm Disc:", invoice.commonDiscount);
  
  console.log("\n--- ITEMS ---");
  invoice.items.forEach((item, i) => {
    console.log(`${i+1}. ${item.name} | Qty: ${item.qty} | Price: ${item.sellingPrice} | Total: ${item.total}`);
  });

  console.log("\n--- EXTRA EXPENSES ---");
  console.log("Array length:", (invoice.extraExpenses || []).length);
  (invoice.extraExpenses || []).forEach((exp, i) => {
    console.log(`${i+1}. Name: ${exp.expenseName} | Base: ${exp.basePrice} | GST: ${exp.gstPercent}% | Total: ${exp.totalPrice}`);
  });

  process.exit();
}

findInvoice();
