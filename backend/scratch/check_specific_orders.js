import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Invoice from '../models/Invoice.js';
import SalesOrder from '../models/SalesOrder.js';

dotenv.config({ path: './.env' });

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const orderNumbers = ['GESO/1165/26-27', 'GESO/1166/26-27', 'GESO/1167/26-27', 'GESO/1168/26-27'];

    for (const num of orderNumbers) {
      console.log(`\n--- Checking order: ${num} ---`);
      const order = await SalesOrder.findOne({ invoiceId: num });
      if (!order) {
        console.log("Order not found");
        continue;
      }
      console.log(`SO ID: ${order._id}`);
      console.log(`SO invoiceId: ${order.invoiceId}`);
      console.log(`SO salesInvoiceId: ${order.salesInvoiceId}`);
      console.log(`SO status: ${order.status}`);
      console.log(`SO invoiceGenerated: ${order.invoiceGenerated}`);

      const invoice = await Invoice.findOne({ salesOrderId: order._id });
      if (invoice) {
        console.log(`Linked Invoice Number: ${invoice.invoiceNumber}`);
        console.log(`Linked Invoice Status: ${invoice.status}`);
        console.log(`Linked Invoice Date: ${invoice.createdAt}`);
      } else {
        console.log("No linked invoice found");
      }
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
