import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import Customer from "../models/Customer.js";
import Invoice from "../models/Invoice.js";
import Receipt from "../models/Receipt.js";
import ManualJournal from "../models/ManualJournal.js";
import CreditNote from "../models/CreditNote.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from backend folder
dotenv.config({ path: path.join(__dirname, "../.env") });

const MONGO_URI = process.env.MONGO_URI;
const shouldFix = process.argv.includes("--fix");

async function run() {
  if (!MONGO_URI) {
    console.error("MONGO_URI not found in environment variables!");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("Connected successfully!");
  console.log(`Mode: ${shouldFix ? "🔧 REPAIR AND SYNC" : "🔍 DRY-RUN AUDIT (Pass '--fix' to apply changes)"}\n`);

  const customers = await Customer.find({}).lean();
  console.log(`Auditing ${customers.length} customers. Please wait...\n`);

  let auditedCount = 0;
  let mismatchedCount = 0;

  for (const customer of customers) {
    const customerId = customer._id.toString();

    // 1. Fetch Invoices
    const invoices = await Invoice.find({
      "customer.customerId": customerId,
      branchId: customer.branchId,
      status: "FINALIZED"
    }).lean();
    const invoicesTotal = invoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);

    // 2. Fetch Receipts
    const receipts = await Receipt.find({
      "customer.customerId": customerId,
      branchId: customer.branchId,
      status: { $in: ["confirmed", "bounced"] }
    }).lean();
    
    const confirmedReceiptsTotal = receipts
      .filter(r => r.status === "confirmed")
      .reduce((sum, r) => sum + (r.amount || 0), 0);
      
    const bouncedReceiptsTotal = receipts
      .filter(r => r.status === "bounced")
      .reduce((sum, r) => sum + (r.amount || 0), 0);

    // 3. Fetch Manual Journals
    const mjBy = await ManualJournal.find({ "by.partyType": "DEBTOR", "by.partyId": customerId }).lean();
    const mjTo = await ManualJournal.find({ "to.partyType": "DEBTOR", "to.partyId": customerId }).lean();

    const mjDrTotal = mjBy.reduce((sum, mj) => sum + (mj.amount || 0), 0);
    const mjCrTotal = mjTo.reduce((sum, mj) => sum + (mj.amount || 0), 0);

    // 4. Fetch Credit Notes
    const creditNotes = await CreditNote.find({
      "customer.customerId": customerId,
      branchId: customer.branchId,
      status: "Created"
    }).lean();
    const creditNotesTotal = creditNotes.reduce((sum, cn) => sum + (cn.grandTotal || 0), 0);

    // 5. Calculate Expected Values
    // If openingBalance is positive, it's a Debit. If negative, it is a Credit.
    const baseDebit = customer.openingBalance > 0 ? Math.round(customer.openingBalance) : 0;
    const baseCredit = customer.openingBalance < 0 ? Math.round(Math.abs(customer.openingBalance)) : 0;

    const expectedDebit = baseDebit + invoicesTotal + bouncedReceiptsTotal + mjDrTotal;
    const expectedCredit = baseCredit + confirmedReceiptsTotal + creditNotesTotal + mjCrTotal;

    const currentDebit = customer.debit || 0;
    const currentCredit = customer.credit || 0;

    // Compare with tolerance of 1 unit
    const debitMismatch = Math.abs(currentDebit - expectedDebit) > 1;
    const creditMismatch = Math.abs(currentCredit - expectedCredit) > 1;

    if (debitMismatch || creditMismatch) {
      mismatchedCount++;
      console.log(`⚠️ MISMATCH DETECTED: Customer "${customer.name}" (${customerId})`);
      console.log(`  - Current DB State -> Debit: ₹${currentDebit}, Credit: ₹${currentCredit}`);
      console.log(`  - Expected State   -> Debit: ₹${expectedDebit}, Credit: ₹${expectedCredit}`);
      console.log(`  - Discrepancy      -> Debit Diff: ₹${Math.abs(currentDebit - expectedDebit)}, Credit Diff: ₹${Math.abs(currentCredit - expectedCredit)}`);

      if (shouldFix) {
        // Apply Mongoose update to fix desynchronization
        await Customer.findByIdAndUpdate(customerId, {
          debit: expectedDebit,
          credit: expectedCredit
        });
        console.log(`  ✅ FIXED: Synchronized customer balances in database!`);
      } else {
        console.log(`  [Action Required] Run script with '--fix' flag to repair.`);
      }
      console.log("-".repeat(80));
    }

    auditedCount++;
  }

  console.log("\n=== AUDIT REPORT SUMMARY ===");
  console.log(`Total Customers Scanned  : ${auditedCount}`);
  console.log(`Desynchronized Records   : ${mismatchedCount}`);
  if (mismatchedCount > 0) {
    if (shouldFix) {
      console.log(`Status                   : 🎉 Successfully repaired and synchronized all ${mismatchedCount} mismatched records!`);
    } else {
      console.log(`Status                   : ⚠️ Action Required. Run 'node scripts/audit_and_fix_balances.js --fix' to repair.`);
    }
  } else {
    console.log(`Status                   : All customer ledger balances are perfectly synchronized! ✅`);
  }

  await mongoose.disconnect();
  console.log("\nDisconnected from MongoDB.");
}

run().catch(console.error);
