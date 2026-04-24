import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({ path: "backend/.env" });

const SalesOrderSchema = new mongoose.Schema({}, { strict: false });
const SalesOrder = mongoose.model("SalesOrder", SalesOrderSchema);

const ReceiptSchema = new mongoose.Schema({}, { strict: false });
const Receipt = mongoose.model("Receipt", ReceiptSchema);

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to DB");

  const recentOrders = await SalesOrder.find({ recordType: "SALES INVOICE" }).sort({ createdAt: -1 }).limit(5);
  
  for (const order of recentOrders) {
    const receipts = await Receipt.find({ originalSalesOrderId: order._id });
    const totalReceived = receipts.reduce((sum, r) => sum + (r.amount || 0), 0);
    
    console.log(`Invoice: ${order.invoiceId}`);
    console.log(`  Grand Total: ${order.grandTotal}`);
    console.log(`  Invoice Grand Total: ${order.invoiceGrandTotal}`);
    console.log(`  Closing Balance: ${order.closingBalance}`);
    console.log(`  Total Received: ${totalReceived}`);
    console.log(`  Record Type: ${order.recordType}`);
    console.log("-------------------");
  }

  await mongoose.disconnect();
}

check();
