import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import Customer from "./models/Customer.js";
import Invoice from "./models/Invoice.js";
import Receipt from "./models/Receipt.js";
import ManualJournal from "./models/ManualJournal.js";

const MONGO_URI = process.env.MONGO_URI;

async function run() {
  if (!MONGO_URI) {
    console.error("MONGO_URI not found in environment!");
    process.exit(1);
  }
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const customerId = "69cc827090a268b9a0b7bf71";

  // Check customer details
  const cust = await Customer.findById(customerId).lean();
  console.log("\n--- CUSTOMER DATABASE RECORD ---");
  console.log(JSON.stringify(cust, null, 2));

  // Check invoices
  const invoices = await Invoice.find({ "customer.customerId": customerId }).lean();
  console.log(`\n--- INVOICES FOR CUSTOMER (Count: ${invoices.length}) ---`);
  invoices.forEach(inv => {
    console.log(`Invoice ${inv.invoiceNumber}: Amount = ${inv.grandTotal}, Status = ${inv.status}, Date = ${inv.invoiceDate || inv.createdAt}`);
  });

  // Check receipts
  const receipts = await Receipt.find({ "customer.customerId": customerId }).lean();
  console.log(`\n--- RECEIPTS FOR CUSTOMER (Count: ${receipts.length}) ---`);
  receipts.forEach(rec => {
    console.log(`Receipt ${rec.receiptNumber}: Amount = ${rec.amount}, Status = ${rec.status}, Date = ${rec.createdAt}`);
  });

  // Check manual journals
  const mjBy = await ManualJournal.find({ "by.partyType": "DEBTOR", "by.partyId": customerId }).lean();
  const mjTo = await ManualJournal.find({ "to.partyType": "DEBTOR", "to.partyId": customerId }).lean();

  console.log(`\n--- MANUAL JOURNALS (DR) (Count: ${mjBy.length}) ---`);
  mjBy.forEach(mj => {
    console.log(`Journal ${mj.journalNumber}: Amount = ${mj.amount}, By = DR, Date = ${mj.journalDate || mj.createdAt}`);
  });

  console.log(`\n--- MANUAL JOURNALS (CR) (Count: ${mjTo.length}) ---`);
  mjTo.forEach(mj => {
    console.log(`Journal ${mj.journalNumber}: Amount = ${mj.amount}, To = CR, Date = ${mj.journalDate || mj.createdAt}`);
  });

  await mongoose.disconnect();
  console.log("\nDisconnected");
}

run().catch(console.error);
