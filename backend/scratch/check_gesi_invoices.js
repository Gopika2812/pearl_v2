import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Invoice from '../models/Invoice.js';
import SalesOrder from '../models/SalesOrder.js';

dotenv.config({ path: './.env' });

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const branchId = '69cbae49bc6c37f37b325547'; // GOMATHI ENTERPRISES branchId from check_counters_debug.js (ge prefix)

    const invoices = await Invoice.find({ branchId }).sort({ createdAt: -1 });
    console.log(`\n--- Found ${invoices.length} Invoices for GOMATHI ENTERPRISES ---`);
    invoices.forEach(i => {
      console.log(`Inv Num: ${i.invoiceNumber}, SO ID: ${i.salesOrderId}, Status: ${i.status}, GrandTotal: ${i.grandTotal}, Created: ${i.createdAt}`);
    });

    const sos = await SalesOrder.find({ branchId }).sort({ createdAt: -1 });
    console.log(`\n--- Found ${sos.length} Sales Orders for GOMATHI ENTERPRISES ---`);
    sos.forEach(s => {
      console.log(`SO ID: ${s.invoiceId}, SI ID: ${s.salesInvoiceId}, Status: ${s.status}, Generated: ${s.invoiceGenerated}, Created: ${s.createdAt}`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
