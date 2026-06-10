import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });
const MONGO_URI = process.env.MONGO_URI;

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB.");

  const Customer = mongoose.model("Customer", new mongoose.Schema({}, { strict: false }));
  const Invoice = mongoose.model("Invoice", new mongoose.Schema({}, { strict: false }));
  const Receipt = mongoose.model("Receipt", new mongoose.Schema({}, { strict: false }));
  const CreditNote = mongoose.model("CreditNote", new mongoose.Schema({}, { strict: false }));
  const ManualJournal = mongoose.model("ManualJournal", new mongoose.Schema({}, { strict: false }));

  // Find Buhari Restaurant
  const customer = await Customer.findOne({ name: /Buhari/i });
  if (!customer) {
    console.log("Customer Buhari Restaurant not found.");
    process.exit(0);
  }

  console.log("--- Customer Fields ---");
  console.log("Name:", customer.name);
  console.log("ID:", customer._id);
  console.log("Opening Balance:", customer.openingBalance);
  console.log("Debit:", customer.debit);
  console.log("Credit:", customer.credit);
  console.log("Net (debit - credit):", (customer.debit || 0) - (customer.credit || 0));

  const branchId = customer.branchId;

  // Let's get all invoices, receipts, credit notes, journals
  const start = new Date("2026-04-01T00:00:00.000Z");
  const end = new Date("2026-06-08T23:59:59.999Z");

  const invoices = await Invoice.find({
    "customer.customerId": customer._id,
    branchId,
    status: "FINALIZED",
    createdAt: { $gte: start, $lte: end }
  });

  const receipts = await Receipt.find({
    "customer.customerId": customer._id,
    branchId,
    status: { $in: ["confirmed", "bounced", "cancelled"] },
    createdAt: { $gte: start, $lte: end }
  });

  const creditNotes = await CreditNote.find({
    "customer.customerId": customer._id,
    branchId,
    status: "Created",
    createdAt: { $gte: start, $lte: end }
  });

  const mjsBy = await ManualJournal.find({
    "by.partyType": "DEBTOR",
    "by.partyId": customer._id,
    createdAt: { $gte: start, $lte: end }
  });

  const mjsTo = await ManualJournal.find({
    "to.partyType": "DEBTOR",
    "to.partyId": customer._id,
    createdAt: { $gte: start, $lte: end }
  });

  console.log("\n--- Invoices ---");
  invoices.forEach(inv => console.log(`Date: ${inv.createdAt}, No: ${inv.invoiceNumber}, GrandTotal: ${inv.grandTotal}`));

  console.log("\n--- Receipts ---");
  receipts.forEach(r => console.log(`Date: ${r.createdAt}, ID: ${r.receiptId}, Status: ${r.status}, Amount: ${r.amount}`));

  console.log("\n--- Credit Notes ---");
  creditNotes.forEach(cn => console.log(`Date: ${cn.createdAt}, ID: ${cn.creditNoteId}, GrandTotal: ${cn.grandTotal}`));

  console.log("\n--- Manual Journals DR ---");
  mjsBy.forEach(mj => console.log(`Date: ${mj.createdAt}, ID: ${mj.journalId}, Amount: ${mj.amount}`));

  console.log("\n--- Manual Journals CR ---");
  mjsTo.forEach(mj => console.log(`Date: ${mj.createdAt}, ID: ${mj.journalId}, Amount: ${mj.amount}`));

  // Total debits and credits since April 1st
  const totalInvoiceDebit = invoices.reduce((sum, i) => sum + (i.grandTotal || 0), 0);
  const totalReceiptCredit = receipts.filter(r => r.status === "confirmed").reduce((sum, r) => sum + (r.amount || 0), 0);
  const totalBouncedDebit = receipts.filter(r => r.status === "bounced").reduce((sum, r) => sum + (r.amount || 0), 0);
  const totalCNCredit = creditNotes.reduce((sum, cn) => sum + (cn.grandTotal || 0), 0);
  const totalMjDebit = mjsBy.reduce((sum, mj) => sum + (mj.amount || 0), 0);
  const totalMjCredit = mjsTo.reduce((sum, mj) => sum + (mj.amount || 0), 0);

  const calculatedBalance = (customer.openingBalance || 0) + totalInvoiceDebit + totalBouncedDebit + totalMjDebit - totalReceiptCredit - totalCNCredit - totalMjCredit;
  console.log("\n--- Calculated Balance starting from Opening Balance (April 1st) ---");
  console.log("Opening Balance (April 1st):", customer.openingBalance || 0);
  console.log("+ Invoices:", totalInvoiceDebit);
  console.log("+ Bounced receipts:", totalBouncedDebit);
  console.log("+ Manual Journals DR:", totalMjDebit);
  console.log("- Confirmed receipts:", totalReceiptCredit);
  console.log("- Credit Notes:", totalCNCredit);
  console.log("- Manual Journals CR:", totalMjCredit);
  console.log("Calculated Closing Balance:", calculatedBalance);

  await mongoose.disconnect();
}

run();
