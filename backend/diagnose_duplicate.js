import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const SalesOrderSchema = new mongoose.Schema({}, { strict: false });
const SalesOrder = mongoose.model("SalesOrder", SalesOrderSchema);

const InvoiceSchema = new mongoose.Schema({}, { strict: false });
const Invoice = mongoose.model("Invoice", InvoiceSchema);

async function run() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected!");

  // Check CSSO/1834/26-27 (recently created, invoiced order)
  const orderId = "6a17c5e68281e6cc8b7f90c1";
  
  const order = await SalesOrder.findById(orderId).lean();
  if (!order) {
    console.log("Order not found!");
    return;
  }
  
  console.log("Order invoiceId:", order.invoiceId);
  console.log("Order status:", order.status);
  console.log("Order isDummy:", order.isDummy);
  console.log("Order editHistory present:", Array.isArray(order.editHistory), "length:", order.editHistory?.length || 0);
  console.log("Order sampleItems:", JSON.stringify(order.sampleItems || []));
  console.log("Order items count:", order.items?.length || 0);
  
  if (order.items && order.items.length > 0) {
    const firstItem = order.items[0];
    console.log("First item productId type:", typeof firstItem.productId, "value:", firstItem.productId);
  }
  
  // Check associated invoice
  const invoice = await Invoice.findOne({ salesOrderId: new mongoose.Types.ObjectId(orderId) }).lean();
  if (invoice) {
    console.log("Invoice invoiceNumber:", invoice.invoiceNumber);
    console.log("Invoice status:", invoice.status);
    console.log("Invoice _id:", invoice._id);
    
    // Simulate what happens when we cancel this invoice via findOneAndUpdate
    // and then check Invoice uniqueness for a new order
    const siPrefix = invoice.invoiceNumber.split('/')[0]; // e.g. "CSSI"
    console.log("Invoice SI Prefix:", siPrefix);
    
    // Check all invoices with this prefix to understand the next SI number
    const siCount = await Invoice.countDocuments({
      branchId: order.branchId,
      invoiceNumber: new RegExp(`^${siPrefix}/`)
    });
    console.log("Total invoices with same SI prefix:", siCount);
  }

  // Check for CANCELLED orders in the same prefix - this is what we look at when generating new ID
  const cancelledOrders = await SalesOrder.find({
    branchId: order.branchId,
    invoiceId: /^CSSO\//,
    status: "CANCELLED"
  }).select("invoiceId status createdAt").sort({ createdAt: -1 }).limit(10).lean();
  
  console.log("Recent CANCELLED CSSO orders:", cancelledOrders);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
