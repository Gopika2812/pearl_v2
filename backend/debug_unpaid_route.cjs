const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config({ path: ".env" });

const SalesOrderSchema = new mongoose.Schema({}, { strict: false });
const SalesOrder = mongoose.model("SalesOrder", SalesOrderSchema);

const ReceiptSchema = new mongoose.Schema({}, { strict: false });
const Receipt = mongoose.model("Receipt", ReceiptSchema);

async function debug() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to DB");

  // Find a customer with invoices
  const order = await SalesOrder.findOne({ status: "INVOICED" });
  if (!order) {
    console.log("No invoiced orders found.");
    return;
  }

  const customerId = order.customer.customerId;
  console.log(`Checking for customer: ${customerId}`);

  const unpaidOrders = await SalesOrder.find({
    "customer.customerId": customerId,
    status: "INVOICED",
  }).sort({ createdAt: 1 });

  console.log(`Found ${unpaidOrders.length} invoiced orders.`);

  const enrichedOrders = await Promise.all(unpaidOrders.map(async (order) => {
    const receipts = await Receipt.find({ 
      originalSalesOrderId: order._id,
      status: { $in: ["confirmed", "bounced"] }
    });
    
    const totalReceived = (receipts || []).reduce((sum, r) => {
      return r.status === "bounced" ? sum - (r.amount || 0) : sum + (r.amount || 0);
    }, 0);

    const invoiceTotal = order.invoiceGrandTotal || order.grandTotal || 0;
    const pending = Math.max(0, invoiceTotal - totalReceived);
    
    return { 
      invoiceId: order.invoiceId,
      invoiceTotal,
      totalReceived,
      pending
    };
  }));

  console.log("Enriched Orders:", enrichedOrders);

  await mongoose.disconnect();
}

debug();
