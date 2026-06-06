import mongoose from 'mongoose';
import dotenv from 'dotenv';
import VoucherType from '../models/VoucherType.js';
import SalesOrder from '../models/SalesOrder.js';
import Invoice from '../models/Invoice.js';

dotenv.config({ path: './.env' });

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Let's find voucher types
    const vouchers = await VoucherType.find({});
    console.log("\n--- Voucher Types ---");
    vouchers.forEach(v => {
      console.log(`Branch: ${v.branchId}, Name: ${v.name}, OrderType: ${v.orderType}, Prefix: ${v.prefix}, Counter: ${v.counter}, FY: ${v.financialYear}`);
    });

    // Let's find recent Sales Orders
    const sos = await SalesOrder.find({}).sort({ createdAt: -1 }).limit(10);
    console.log("\n--- Recent Sales Orders ---");
    sos.forEach(s => {
      console.log(`SO ID: ${s.invoiceId}, SI ID: ${s.salesInvoiceId}, Status: ${s.status}, Generated: ${s.invoiceGenerated}, Date: ${s.createdAt}`);
    });

    // Let's find recent Invoices
    const invoices = await Invoice.find({}).sort({ createdAt: -1 }).limit(10);
    console.log("\n--- Recent Invoices ---");
    invoices.forEach(i => {
      console.log(`Inv Num: ${i.invoiceNumber}, SO ID: ${i.salesOrderId}, Status: ${i.status}, Date: ${i.createdAt}`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
