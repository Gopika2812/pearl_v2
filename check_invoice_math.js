import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SalesOrder from './backend/models/SalesOrder.js';

dotenv.config({ path: './backend/.env' });

async function checkInvoice() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to DB");

    const invoiceId = "Z-2SI/044/26-27";
    const order = await SalesOrder.findOne({ invoiceId })
      .populate('branchId')
      .populate('customer.customerId');

    if (!order) {
      console.log("Invoice not found:", invoiceId);
      process.exit(1);
    }

    console.log("\n=== INVOICE SUMMARY ===");
    console.log("Invoice ID:  ", order.invoiceId);
    console.log("Grand Total: ", order.grandTotal);
    console.log("Subtotal:    ", order.subtotal);
    console.log("Total Tax:   ", order.totalTax);
    console.log("Extra Exp:   ", order.extraExpenseAmount);
    console.log("Transport:   ", order.transportCharge);
    console.log("Comm Disc:   ", order.commonDiscount);
    console.log("Round Off:   ", order.roundOff);

    console.log("\n=== REGULAR ITEMS ===");
    let itemsAssVal = 0;
    let itemsTax = 0;
    order.items.forEach((item, i) => {
      const assAmt = (item.qty * item.sellingPrice) - (item.discountAmount || 0);
      const tax = (item.cgst || 0) + (item.sgst || 0) + (item.igst || 0);
      itemsAssVal += assAmt;
      itemsTax += tax;
      console.log(`${i+1}. ${item.name.padEnd(20)} | Qty: ${String(item.qty).padStart(4)} | Price: ${String(item.sellingPrice).padStart(8)} | Tax: ${String(tax.toFixed(2)).padStart(8)} | Total: ${String(item.total.toFixed(2)).padStart(10)}`);
    });

    console.log("\n=== EXTRA EXPENSES ===");
    (order.extraExpenses || []).forEach((exp, i) => {
      console.log(`${i+1}. ${exp.name.padEnd(20)} | Price: ${exp.basePrice} | Tax: ${exp.gstAmount} | Total: ${exp.totalPrice}`);
    });

    console.log("\n=== MATH CHECK ===");
    const sumLinesTax = itemsTax;
    const sumLinesTotal = order.items.reduce((s, i) => s + i.total, 0);
    console.log("Sum of Items Total: ", sumLinesTotal);
    console.log("Sum of Items Tax:   ", sumLinesTax);
    
    // Check for discrepancies
    const expectedGrand = order.subtotal + (typeof order.totalTax === 'number' ? order.totalTax : order.totalTax?.total || 0) + (order.extraExpenseAmount || 0) + (order.transportCharge || 0) - (order.commonDiscount || 0);
    console.log("Expected Grand Total (Manual Sum): ", expectedGrand);
    console.log("DB Grand Total:                  ", order.grandTotal);

    mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

checkInvoice();
