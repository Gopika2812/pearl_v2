import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import Customer from "./models/Customer.js";
import Invoice from "./models/Invoice.js";
import Receipt from "./models/Receipt.js";
import ManualJournal from "./models/ManualJournal.js";
import CreditNote from "./models/CreditNote.js";

const MONGO_URI = process.env.MONGO_URI;

async function run() {
  if (!MONGO_URI) {
    console.error("MONGO_URI not found in environment!");
    process.exit(1);
  }
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const customerId = "69cc827090a268b9a0b7bf71";

  // 1. Fetch customer
  const customer = await Customer.findById(customerId);
  if (!customer) {
    console.error("Customer not found!");
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`\nReconciling customer: ${customer.name} (${customer._id})`);
  console.log(`Current DB State -> Debit: ${customer.debit}, Credit: ${customer.credit}, OpeningBalance: ${customer.openingBalance}`);

  // 2. Fetch all finalized Invoices
  const invoices = await Invoice.find({
    "customer.customerId": customerId,
    branchId: customer.branchId,
    status: "FINALIZED"
  });
  const invoicesTotal = invoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
  console.log(`Invoices Total (Debit): ₹${invoicesTotal} (Count: ${invoices.length})`);

  // 3. Fetch all Receipts
  const receipts = await Receipt.find({
    "customer.customerId": customerId,
    branchId: customer.branchId,
    status: { $in: ["confirmed", "bounced"] }
  });
  
  const confirmedReceiptsTotal = receipts
    .filter(r => r.status === "confirmed")
    .reduce((sum, r) => sum + (r.amount || 0), 0);
    
  const bouncedReceiptsTotal = receipts
    .filter(r => r.status === "bounced")
    .reduce((sum, r) => sum + (r.amount || 0), 0);
    
  console.log(`Confirmed Receipts Total (Credit): ₹${confirmedReceiptsTotal}`);
  console.log(`Bounced Receipts Total (Debit): ₹${bouncedReceiptsTotal}`);

  // 4. Fetch Manual Journals
  const mjBy = await ManualJournal.find({ "by.partyType": "DEBTOR", "by.partyId": customerId });
  const mjTo = await ManualJournal.find({ "to.partyType": "DEBTOR", "to.partyId": customerId });

  const mjDrTotal = mjBy.reduce((sum, mj) => sum + (mj.amount || 0), 0);
  const mjCrTotal = mjTo.reduce((sum, mj) => sum + (mj.amount || 0), 0);

  console.log(`Manual Journals (DR) Total: ₹${mjDrTotal} (Count: ${mjBy.length})`);
  console.log(`Manual Journals (CR) Total: ₹${mjCrTotal} (Count: ${mjTo.length})`);

  // 5. Fetch Credit Notes
  const creditNotes = await CreditNote.find({
    "customer.customerId": customerId,
    branchId: customer.branchId,
    status: "Created"
  });
  const creditNotesTotal = creditNotes.reduce((sum, cn) => sum + (cn.grandTotal || 0), 0);
  console.log(`Credit Notes Total (Credit): ₹${creditNotesTotal} (Count: ${creditNotes.length})`);

  // 6. Calculate cumulative debit and credit
  // Customer starts with an opening balance of 3855.98 (~3856) DR
  // So baseDebit starts at 3856.
  const baseDebit = Math.round(customer.openingBalance || 3856);
  const baseCredit = 0;

  const newDebit = baseDebit + invoicesTotal + bouncedReceiptsTotal + mjDrTotal;
  const newCredit = baseCredit + confirmedReceiptsTotal + creditNotesTotal + mjCrTotal;

  console.log(`\nCalculated Targets:`);
  console.log(`  - New Debit: ₹${newDebit} (Base ₹${baseDebit} + Invoices ₹${invoicesTotal} + Bounced ₹${bouncedReceiptsTotal} + Journals DR ₹${mjDrTotal})`);
  console.log(`  - New Credit: ₹${newCredit} (Base ₹${baseCredit} + Confirmed ₹${confirmedReceiptsTotal} + CreditNotes ₹${creditNotesTotal} + Journals CR ₹${mjCrTotal})`);
  console.log(`  - Net Balance: ₹${newDebit - newCredit} (${newDebit >= newCredit ? "DR" : "CR"})`);

  // 7. Update Customer record
  customer.debit = newDebit;
  customer.credit = newCredit;
  await customer.save();

  console.log(`\nSuccessfully updated Customer document in database!`);
  
  // Verify with fresh query
  const updatedCust = await Customer.findById(customerId).lean();
  console.log("Verified database document:", JSON.stringify(updatedCust, null, 2));

  await mongoose.disconnect();
  console.log("Disconnected");
}

run().catch(console.error);
