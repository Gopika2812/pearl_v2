const mongoose = require("mongoose");
require("dotenv").config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const Invoice = mongoose.model("Invoice", new mongoose.Schema({
    invoiceNumber: String,
    customer: mongoose.Schema.Types.Mixed,
    status: String
  }), "invoices");

  // Search by customer name inside the customer subdocument
  const docs = await Invoice.find({
    $or: [
      { "customer.name": /Lakshman/i },
      { "customer.name": /Golden/i }
    ]
  }).limit(5).lean();

  console.log(`Found ${docs.length} matches:`);
  docs.forEach(doc => {
    console.log("-----------------------------------------");
    console.log(`InvoiceNumber: ${doc.invoiceNumber}`);
    console.log(`Status: ${doc.status}`);
    console.log(`Customer:`, JSON.stringify(doc.customer, null, 2));
  });

  await mongoose.disconnect();
}

run().catch(console.error);
