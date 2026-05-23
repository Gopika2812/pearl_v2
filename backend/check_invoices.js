import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import Invoice from "./models/Invoice.js";
import Customer from "./models/Customer.js";

const MONGO_URI = process.env.MONGO_URI;

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const customer = await Customer.findOne({ name: /SUBASH SWEETS/i });
  if (!customer) {
    console.log("Customer not found");
    await mongoose.disconnect();
    return;
  }

  console.log("Found Customer:", customer.name, "ID:", customer._id);
  console.log("Customer debit:", customer.debit, "credit:", customer.credit);

  const invoices = await Invoice.find({ "customer.customerId": customer._id });
  console.log("\n--- INVOICES IN DB ---");
  let sum = 0;
  invoices.forEach((inv, idx) => {
    console.log(`${idx + 1}. Number: ${inv.invoiceNumber}, Date: ${inv.invoiceDate}, Status: ${inv.status}, GrandTotal: ${inv.grandTotal}`);
    if (["FINALIZED", "PRINTED", "SENT"].includes(inv.status)) {
      sum += inv.grandTotal;
    }
  });
  console.log("Calculated Sum in JS for valid statuses:", sum);

  await mongoose.disconnect();
}

run().catch(console.error);
