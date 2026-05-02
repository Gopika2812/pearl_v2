import mongoose from 'mongoose';
import Invoice from './models/Invoice.js';
import SalesOrder from './models/SalesOrder.js';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/pearl_v2")
  .then(async () => {
    const invoices = await Invoice.find({ status: { $ne: "CANCELLED" } });
    let fixedCount = 0;
    
    for (const inv of invoices) {
      if (!inv.salesOrderId) continue;
      const so = await SalesOrder.findById(inv.salesOrderId);
      if (!so) continue;
      
      let needsSave = false;
      
      // Sync missing fields from SO to Invoice
      if ((so.extraExpenseAmount > 0 && inv.extraExpenseAmount !== so.extraExpenseAmount) || 
          (so.extraExpenses && so.extraExpenses.length > 0 && (!inv.extraExpenses || inv.extraExpenses.length === 0))) {
        
        inv.extraExpenseAmount = so.extraExpenseAmount;
        inv.extraExpenses = so.extraExpenses;
        needsSave = true;
      }
      
      // Also check if totalTax is missing the extraExpense GST
      if (so.extraExpenses && so.extraExpenses.length > 0) {
        let extraGst = 0;
        so.extraExpenses.forEach(exp => {
          extraGst += Number(exp.gstAmount || 0);
        });
        
        if (extraGst > 0) {
          // If totalTax.total does not include extraGst, add it.
          // Wait, let's just recalculate expected tax.
          const itemsTax = inv.items.reduce((sum, item) => sum + ((item.total || 0) - ((item.sellingPrice || 0) * (item.qty || 0) - (item.discountAmount || 0))), 0);
          const tGst = inv.transportGstAmount || 0;
          const expectedTax = itemsTax + tGst + extraGst;
          
          if (Math.abs(inv.totalTax.total - expectedTax) > 2) {
             // Let's just fix it.
             inv.totalTax.cgst += extraGst / 2;
             inv.totalTax.sgst += extraGst / 2;
             inv.totalTax.total += extraGst;
             needsSave = true;
          }
        }
      }
      
      if (needsSave) {
        await inv.save();
        fixedCount++;
        console.log(`Fixed invoice ${inv.invoiceNumber}`);
      }
    }
    
    console.log(`Fixed ${fixedCount} invoices`);
    process.exit(0);
  });
