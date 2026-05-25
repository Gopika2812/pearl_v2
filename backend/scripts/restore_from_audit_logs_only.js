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

async function run() {
  if (!MONGO_URI) {
    console.error("❌ MONGO_URI not found in environment variables!");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("Connected successfully!");

  const AuditLog = mongoose.connection.db.collection("auditlogs");

  console.log("\n--- STEP 1: Scanning Audit Logs for Manual Changes ---");
  
  // Sort by date ASCENDING so that the newest edits are applied last (newest edit wins!)
  const logs = await AuditLog.find({
    action: "CUSTOMER_FINANCIAL_UPDATE"
  }).sort({ createdAt: 1 }).toArray();

  console.log(`Found ${logs.length} financial update logs in total.`);

  // Map of customerId -> final restored openingBalance
  const restoredBalancesMap = new Map();
  const customerNamesMap = new Map();

  for (const log of logs) {
    if (!log.changes || !log.changes.after || log.changes.after.openingBalance === undefined) {
      continue;
    }

    const beforeVal = Number(log.changes.before.openingBalance) || 0;
    const afterVal = Number(log.changes.after.openingBalance) || 0;

    // Only map if the opening balance was actually changed
    if (beforeVal !== afterVal) {
      const targetId = log.targetId?.toString();
      if (!targetId) continue;

      restoredBalancesMap.set(targetId, afterVal);
      
      // Parse customer name from description if possible
      const desc = log.description || "";
      const match = desc.match(/updated for (.+?)\./i);
      if (match && match[1]) {
        customerNamesMap.set(targetId, match[1].trim());
      }
    }
  }

  console.log(`\nIdentified ${restoredBalancesMap.size} customers to restore from logs.`);

  if (restoredBalancesMap.size === 0) {
    console.log("❌ No manual opening balance adjustments found in audit logs.");
    await mongoose.disconnect();
    return;
  }

  // --- STEP 2: RESTORE OPENING BALANCES ---
  console.log("\n--- STEP 2: Restoring Opening Balances in Database ---");
  const updatedCustomerIds = [];

  for (const [customerId, openingBal] of restoredBalancesMap.entries()) {
    try {
      const customer = await Customer.findById(customerId);
      if (customer) {
        await Customer.findByIdAndUpdate(customer._id, {
          openingBalance: openingBal,
          manualOpeningDate: new Date("2026-03-31T23:59:59.999Z")
        });
        console.log(`✅ Restored: "${customer.name}" -> Opening Balance: ₹${openingBal}`);
        updatedCustomerIds.push(customer._id);
      } else {
        const loggedName = customerNamesMap.get(customerId) || "Unknown";
        console.log(`⚠️ Customer "${loggedName}" (${customerId}) no longer exists in database.`);
      }
    } catch (err) {
      console.error(`❌ Failed to update customer ${customerId}:`, err.message);
    }
  }

  // --- STEP 3: RECALCULATE DEBIT AND CREDIT TOTALS ---
  console.log("\n--- STEP 3: Recalculating and Synchronizing Live Balances ---");
  let fixedCount = 0;

  for (const customerId of updatedCustomerIds) {
    const customer = await Customer.findById(customerId);
    if (!customer) continue;

    const customerIdStr = customer._id.toString();

    // 1. Fetch Invoices
    const invoices = await Invoice.find({
      "customer.customerId": customerIdStr,
      branchId: customer.branchId,
      status: "FINALIZED"
    }).lean();
    const invoicesTotal = invoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);

    // 2. Fetch Receipts
    const receipts = await Receipt.find({
      "customer.customerId": customerIdStr,
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
    const mjBy = await ManualJournal.find({ "by.partyType": "DEBTOR", "by.partyId": customerIdStr }).lean();
    const mjTo = await ManualJournal.find({ "to.partyType": "DEBTOR", "to.partyId": customerIdStr }).lean();

    const mjDrTotal = mjBy.reduce((sum, mj) => sum + (mj.amount || 0), 0);
    const mjCrTotal = mjTo.reduce((sum, mj) => sum + (mj.amount || 0), 0);

    // 4. Fetch Credit Notes
    const creditNotes = await CreditNote.find({
      "customer.customerId": customerIdStr,
      branchId: customer.branchId,
      status: "Created"
    }).lean();
    const creditNotesTotal = creditNotes.reduce((sum, cn) => sum + (cn.grandTotal || 0), 0);

    // 5. Calculate Live Totals based on correct openingBalance
    const baseDebit = customer.openingBalance > 0 ? Math.round(customer.openingBalance) : 0;
    const baseCredit = customer.openingBalance < 0 ? Math.round(Math.abs(customer.openingBalance)) : 0;

    const expectedDebit = baseDebit + invoicesTotal + bouncedReceiptsTotal + mjDrTotal;
    const expectedCredit = baseCredit + confirmedReceiptsTotal + creditNotesTotal + mjCrTotal;

    // Apply Mongoose update to synchronize live debit/credit fields
    await Customer.findByIdAndUpdate(customerId, {
      debit: expectedDebit,
      credit: expectedCredit
    });

    console.log(`✨ Re-synchronized Balances for "${customer.name}":`);
    console.log(`    - Opening Balance: ₹${customer.openingBalance}`);
    console.log(`    - Live Debit     : ₹${expectedDebit} (was ₹${customer.debit || 0})`);
    console.log(`    - Live Credit    : ₹${expectedCredit} (was ₹${customer.credit || 0})`);
    console.log(`    - Closing Balance: ₹${expectedDebit - expectedCredit} (${expectedDebit >= expectedCredit ? "Dr" : "Cr"})`);
    console.log("-".repeat(60));
    fixedCount++;
  }

  console.log(`\n🎉 SUCCESS: Restored and synchronized ${fixedCount} customer accounts perfectly!`);
  
  await mongoose.disconnect();
  console.log("Disconnected from MongoDB.");
}

run().catch(console.error);
