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

  const invNos = [
    "Z-1SI/063/26-27",
    "Z-1SI/064/26-27",
    "Z-1SI/066/26-27",
    "Z-1SI/069/26-27",
    "Z-1SI/091/26-27",
    "Z-1SI/094/26-27"
  ];

  const docs = await Invoice.find({ invoiceNumber: { $in: invNos } }).lean();
  console.log(`Found ${docs.length} matches:`);
  docs.forEach(doc => {
    console.log("-----------------------------------------");
    console.log(`InvoiceNumber: ${doc.invoiceNumber}`);
    console.log(`Customer Name: ${doc.customer?.name}`);
    console.log(`Customer GSTIN: ${doc.customer?.gstin}`);
    console.log(`Customer Details:`, JSON.stringify(doc.customer, null, 2));
  });

  await mongoose.disconnect();
}

run().catch(console.error);
