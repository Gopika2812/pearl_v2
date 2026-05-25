import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import XLSX from "xlsx";

import Customer from "../models/Customer.js";
import Branch from "../models/Branch.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from backend folder
dotenv.config({ path: path.join(__dirname, "../.env") });

const MONGO_URI = process.env.MONGO_URI;

// Check command line arguments
const excelFilePath = process.argv[2];
const branchInput = process.argv[3]; // Can be Branch Name (e.g. "LAKSHMAN ENTERPRISES") or Branch ID

async function run() {
  if (!MONGO_URI) {
    console.error("❌ MONGO_URI not found in environment variables!");
    process.exit(1);
  }

  if (!excelFilePath) {
    console.error("❌ Please provide the path to your Excel file!");
    console.error("Usage: node scripts/recover_everything.js <path_to_excel_file> \"<branch_name_or_id>\"");
    console.error("Example: node scripts/recover_everything.js balances.xlsx \"LAKSHMAN ENTERPRISES\"");
    process.exit(1);
  }

  const resolvedPath = path.resolve(excelFilePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ Excel file not found at path: ${resolvedPath}`);
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("Connected successfully!");

  // --- STEP 0: FETCH AND VALIDATE BRANCH ---
  const allBranches = await Branch.find({}).lean();
  
  if (!branchInput) {
    console.log("\n❌ Error: Branch name or ID is required as the second argument!");
    console.log("\nHere is a list of your 5 branches in the database. Please copy the name or ID of the branch you want to load:");
    console.log("=".repeat(80));
    allBranches.forEach(b => {
      console.log(`🏠 Branch Name: "${b.name}" | ID: ${b._id}`);
    });
    console.log("=".repeat(80));
    console.log("Usage: node scripts/recover_everything.js balances.xlsx \"LAKSHMAN ENTERPRISES\"\n");
    await mongoose.disconnect();
    process.exit(1);
  }

  let selectedBranch = null;
  // Try matching by ID first
  if (mongoose.Types.ObjectId.isValid(branchInput)) {
    selectedBranch = allBranches.find(b => b._id.toString() === branchInput);
  }
  // Try matching by Name (case-insensitive exact or partial match)
  if (!selectedBranch) {
    const searchNormalized = branchInput.toLowerCase().replace(/[^a-z0-9]/g, "");
    selectedBranch = allBranches.find(b => {
      const bNormalized = b.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      return bNormalized.includes(searchNormalized) || searchNormalized.includes(bNormalized);
    });
  }

  if (!selectedBranch) {
    console.error(`\n❌ Error: Could not find any branch matching: "${branchInput}"`);
    console.log("\nAvailable branches are:");
    allBranches.forEach(b => {
      console.log(`🏠 "${b.name}" (ID: ${b._id})`);
    });
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`\n🎯 TARGET BRANCH IDENTIFIED: "${selectedBranch.name}" (ID: ${selectedBranch._id})`);

  const AuditLog = mongoose.connection.db.collection("auditlogs");

  // --- STEP 1: APPLY EXCEL BASE VALUES FOR THIS BRANCH ---
  console.log(`\n--- STEP 1: Reading Excel file from: ${resolvedPath}...`);
  const workbook = XLSX.readFile(resolvedPath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: "" });

  console.log(`Loaded ${rows.length} rows from sheet "${sheetName}".`);

  let excelUpdatedCount = 0;
  let excelSkippedCount = 0;

  for (const row of rows) {
    const normalizedRow = Object.fromEntries(
      Object.entries(row).map(([k, v]) => [
        k.replace(/[\s"\n\r]+/g, "").toLowerCase(),
        String(v || "").trim(),
      ])
    );

    const name = normalizedRow.customername || normalizedRow.name || normalizedRow.debtorname || normalizedRow.debtor;
    if (!name) {
      excelSkippedCount++;
      continue;
    }

    // Define aliases for Debit
    const debitAliases = [
      "debit", "debitbalance", "dr", "drbalance", "openingdebit", "openingdr", 
      "openingdrbalance", "amountdr", "debitamount", "de", "deb", "debt"
    ];
    
    // Define aliases for Credit
    const creditAliases = [
      "credit", "creditbalance", "cr", "crbalance", "openingcredit", "openingcr", 
      "openingcrbalance", "amountcr", "creditamount", "cre", "cred"
    ];
    
    // Define aliases for general single balance columns
    const generalBalanceAliases = [
      "openingbalance", "balance", "outstanding", "amount", "netbalance", "closingbalance",
      "outstandingamount", "bal"
    ];
    
    // Helper to find the first matching value in normalizedRow
    const findVal = (aliases) => {
      for (const alias of aliases) {
        if (normalizedRow[alias] !== undefined && normalizedRow[alias] !== "") {
          return normalizedRow[alias];
        }
      }
      return undefined;
    };

    const rawDebitVal = findVal(debitAliases);
    const rawCreditVal = findVal(creditAliases);
    const rawGeneralVal = findVal(generalBalanceAliases);
    const rawTypeVal = normalizedRow.type || normalizedRow.balancetype || normalizedRow.drcr || normalizedRow.drdecr || "";

    let excelDebit = 0;
    let excelCredit = 0;
    let hasFinancialData = false;

    if (rawDebitVal !== undefined || rawCreditVal !== undefined) {
      excelDebit = parseFloat(String(rawDebitVal || 0).replace(/[^0-9.-]+/g, "")) || 0;
      excelCredit = parseFloat(String(rawCreditVal || 0).replace(/[^0-9.-]+/g, "")) || 0;
      hasFinancialData = true;
    } else if (rawGeneralVal !== undefined) {
      const rawStr = String(rawGeneralVal).trim();
      const numericVal = parseFloat(rawStr.replace(/[^0-9.-]+/g, "")) || 0;
      const isCrType = /cr|credit/i.test(rawStr) || /cr|credit/i.test(rawTypeVal) || numericVal < 0;

      if (isCrType) {
        excelCredit = Math.abs(numericVal);
        excelDebit = 0;
      } else {
        excelDebit = Math.abs(numericVal);
        excelCredit = 0;
      }
      hasFinancialData = true;
    }

    if (!hasFinancialData) {
      excelSkippedCount++;
      continue;
    }

    const calculatedOpeningBalance = excelDebit - excelCredit;

    // Search for customer by name AND TARGET BRANCH ONLY (case-insensitive exact match)
    const normalizedSearchName = name.toLowerCase().replace(/\s+/g, " ").trim();
    const customer = await Customer.findOne({
      branchId: selectedBranch._id,
      name: { $regex: new RegExp(`^${escapeRegex(normalizedSearchName)}$`, "i") }
    });

    if (customer) {
      const oldOpening = customer.openingBalance || 0;
      const newOpening = calculatedOpeningBalance;

      if (oldOpening !== newOpening) {
        await Customer.findByIdAndUpdate(customer._id, {
          openingBalance: newOpening,
          manualOpeningDate: new Date("2026-03-31T23:59:59.999Z")
        });

        await AuditLog.insertOne({
          user: selectedBranch._id,
          userModel: "SuperAdmin",
          username: "System",
          branchId: selectedBranch._id,
          action: "CUSTOMER_FINANCIAL_UPDATE",
          targetId: customer._id,
          targetModel: "Customer",
          description: `Financial details updated automatically via recover_everything script for ${customer.name}. Opening Bal: ${oldOpening} -> ${newOpening}.`,
          changes: {
            before: {
              openingBalance: oldOpening,
              debit: customer.debit || 0,
              credit: customer.credit || 0
            },
            after: {
              openingBalance: newOpening,
              debit: customer.debit || 0,
              credit: customer.credit || 0
            }
          },
          createdAt: new Date(),
          updatedAt: new Date()
        });
        excelUpdatedCount++;
      } else {
        excelSkippedCount++;
      }
    } else {
      excelSkippedCount++;
    }
  }

  console.log(`✅ Base opening balances set for ${excelUpdatedCount} customers under branch "${selectedBranch.name}" from Excel!`);

  // --- STEP 2: APPLY MANUAL OVERRIDES FROM AUDIT LOGS FOR THIS BRANCH ---
  console.log("\n--- STEP 2: Scanning Audit Logs for Manual Changes ---");
  
  // Sort by date ASCENDING so that the newest edits are applied last (newest edit wins!)
  const logs = await AuditLog.find({
    $or: [
      { branchId: selectedBranch._id },
      { branchId: selectedBranch._id.toString() }
    ],
    action: "CUSTOMER_FINANCIAL_UPDATE"
  }).sort({ createdAt: 1 }).toArray();

  console.log(`Found ${logs.length} manual update logs for branch "${selectedBranch.name}".`);

  let manualAppliedCount = 0;

  for (const log of logs) {
    if (!log.changes || !log.changes.after || log.changes.after.openingBalance === undefined) {
      continue;
    }

    const beforeVal = Number(log.changes.before.openingBalance) || 0;
    const afterVal = Number(log.changes.after.openingBalance) || 0;

    // Only apply if the opening balance was actually changed manually
    if (beforeVal !== afterVal) {
      const targetId = log.targetId;
      if (!targetId) continue;

      const customer = await Customer.findOne({
        _id: new mongoose.Types.ObjectId(targetId),
        branchId: selectedBranch._id
      });

      if (customer) {
        await Customer.findByIdAndUpdate(customer._id, {
          openingBalance: afterVal,
          manualOpeningDate: new Date("2026-03-31T23:59:59.999Z")
        });
        console.log(`✨ Re-applied Manual Override: "${customer.name}" -> Opening Balance: ₹${afterVal} (Set on ${log.createdAt})`);
        manualAppliedCount++;
      }
    }
  }

  console.log(`✅ Applied ${manualAppliedCount} manual adjustments successfully from audit logs!`);

  console.log("\n🚀 Done! Disconnecting from MongoDB...");
  await mongoose.disconnect();
  console.log("Disconnected successfully!");
}

function escapeRegex(string) {
  return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

run().catch(console.error);
