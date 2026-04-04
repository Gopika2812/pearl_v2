import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SalesOrder from './backend/models/SalesOrder.js';

dotenv.config({ path: './backend/.env' });

async function checkInvoice() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to DB");

  const invoiceId = "Z-2SI/044/26-27";
  const order = await SalesOrder.findOne({ invoiceId }).populate('branchId');

  if (!order) {
    console.log("Invoice not found");
    return;
  }

  console.log("--- INVOICE DETAILS ---");
  console.log("ID:", order.invoiceId);
  console.log("Grand Total:", order.grandTotal);
  console.log("Subtotal:", order.subtotal);
  console.log("Total Tax:", order.totalTax);
  console.log("Extra Expense:", order.extraExpenseAmount);
  console.log("Transport Charge:", order.transportCharge);
  console.log("Common Discount:", order.commonDiscount);

  console.log("\n--- ITEMS ---");
  order.items.forEach((item, i) => {
    console.log(`${i+1}. ${item.name} | Qty: ${item.qty} | Price: ${item.sellingPrice} | GST: ${item.gst}% | Disc: ${item.discountAmount}`);
  });

  console.log("\n--- SAMPLE ITEMS ---");
  (order.sampleItems || []).forEach((item, i) => {
    console.log(`${i+1}. ${item.name} | Qty: ${item.qty}`);
  });

  process.exit();
}

checkInvoice();
