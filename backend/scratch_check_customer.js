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
    "Z-ISI/054/26-27",
    "Z-ISI/059/26-27",
    "Z-ISI/063/26-27",
    "Z-ISI/064/26-27",
    "Z-ISI/066/26-27",
    "Z-ISI/069/26-27"
  ];

  const docs = await Invoice.find({ invoiceNumber: { $in: invNos } }).lean();
  console.log(`Found ${docs.length} matches:`);
  docs.forEach(doc => {
    console.log("-----------------------------------------");
    console.log(`Invoice: ${doc.invoiceNumber}`);
    console.log(`Status: ${doc.status}`);
    console.log(`Customer:`, JSON.stringify(doc.customer, null, 2));
  });

  await mongoose.disconnect();
  console.log("Disconnected");
}

run().catch(console.error);
