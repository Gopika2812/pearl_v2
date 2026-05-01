import mongoose from 'mongoose';
import Invoice from './models/Invoice.js';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/pearl_v2")
  .then(async () => {
    const inv = await Invoice.findOne({ invoiceNumber: { $regex: "BSI/012/" } });
    if (inv) {
      const itemsTotal = inv.items.reduce((sum, item) => sum + (item.total || 0), 0);
      console.log(`Invoice: ${inv.invoiceNumber}`);
      console.log(`grandTotal: ${inv.grandTotal}`);
      console.log(`itemsTotal (sum of item.total): ${itemsTotal}`);
      console.log(`subtotal: ${inv.subtotal}`);
      console.log(`totalTax: ${typeof inv.totalTax === 'object' ? JSON.stringify(inv.totalTax) : inv.totalTax}`);
      console.log(`transportCharge: ${inv.transportCharge}`);
      console.log(`extraExpenseAmount: ${inv.extraExpenseAmount}`);
      console.log(`totalDiscount: ${inv.totalDiscount}`);
    } else {
      console.log("Not found");
    }
    process.exit(0);
  });
