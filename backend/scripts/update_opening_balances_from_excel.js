import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import XLSX from "xlsx";

import Customer from "../models/Customer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from backend folder
dotenv.config({ path: path.join(__dirname, "../.env") });

const MONGO_URI = process.env.MONGO_URI;

// Check command line arguments for the file path
const excelFilePath = process.argv[2];

async function run() {
  if (!MONGO_URI) {
    console.error("❌ MONGO_URI not found in environment variables!");
    process.exit(1);
  }

  if (!excelFilePath) {
    console.error("❌ Please provide the path to your Excel file!");
    console.error("Usage: node scripts/update_opening_balances_from_excel.js <path_to_excel_file>");
    console.error("Example: node scripts/update_opening_balances_from_excel.js \"E:\\LAKSHMAN_ENTERPRISES_DEBTORS_CONSOLIDATED.xlsx\"");
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

  const AuditLog = mongoose.connection.db.collection("auditlogs");

  console.log(`Reading Excel file from: ${resolvedPath}...`);
  const workbook = XLSX.readFile(resolvedPath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: "" });

  console.log(`Successfully loaded ${rows.length} rows from sheet "${sheetName}".`);

  let matchedCount = 0;
  let updatedCount = 0;
  let notFoundCount = 0;
  let skippedCount = 0;

  // We will perform updates in a transaction or loop through
  for (const row of rows) {
    // Normalize row keys and values
    const normalizedRow = Object.fromEntries(
      Object.entries(row).map(([k, v]) => [
        k.replace(/[\s"\n\r]+/g, "").toLowerCase(),
        String(v || "").trim(),
      ])
    );

    const name = normalizedRow.customername || normalizedRow.name;
    if (!name) {
      skippedCount++;
      continue;
    }

    // Define aliases for Debit
    const debitAliases = [
      "debit", "debitbalance", "dr", "drbalance", "openingdebit", "openingdr", 
      "openingdrbalance", "amountdr", "debitamount"
    ];
    
    // Define aliases for Credit
    const creditAliases = [
      "credit", "creditbalance", "cr", "crbalance", "openingcredit", "openingcr", 
      "openingcrbalance", "amountcr", "creditamount"
    ];
    
    // Define aliases for general single balance columns (like 'Opening Balance' or 'Balance')
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
      skippedCount++;
      continue;
    }

    const calculatedOpeningBalance = excelDebit - excelCredit;

    // Search for customer by name (case-insensitive exact match)
    const normalizedSearchName = name.toLowerCase().replace(/\s+/g, " ").trim();
    const customer = await Customer.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(normalizedSearchName)}$`, "i") }
    });

    if (customer) {
      matchedCount++;
      const oldOpening = customer.openingBalance || 0;
      const newOpening = calculatedOpeningBalance;
      
      if (oldOpening !== newOpening) {
        // Update ONLY the openingBalance and manualOpeningDate fields!
        // This leaves their debit/credit/transactions completely untouched for now
        await Customer.findByIdAndUpdate(customer._id, {
          openingBalance: newOpening,
          manualOpeningDate: new Date("2026-03-31T23:59:59.999Z")
        });

        await AuditLog.insertOne({
          user: customer.branchId, // Fallback to branchId
          userModel: "SuperAdmin",
          username: "System",
          branchId: customer.branchId,
          action: "CUSTOMER_FINANCIAL_UPDATE",
          targetId: customer._id,
          targetModel: "Customer",
          description: `Financial details updated automatically via update_opening_balances script for ${customer.name}. Opening Bal: ${oldOpening} -> ${newOpening}.`,
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
        
        console.log(`✅ Matched & Updated: "${customer.name}" -> Opening Balance: ₹${newOpening} (Logged to Audit Logs)`);
        updatedCount++;
      } else {
        console.log(`ℹ️ Unchanged: "${customer.name}" already has Opening Balance: ₹${newOpening}`);
      }
    } else {
      console.log(`⚠️ Not Found in Database: "${name}"`);
      notFoundCount++;
    }
  }

  console.log("\n=== MIGRATION REPORT ===");
  console.log(`Total rows processed: ${rows.length}`);
  console.log(`Matched & Updated   : ${updatedCount}`);
  console.log(`Not found in DB     : ${notFoundCount}`);
  console.log(`Skipped (No Balance): ${skippedCount}`);
  
  console.log("\n🚀 Done updating opening balances. Now disconnect from MongoDB...");
  await mongoose.disconnect();
  console.log("Disconnected successfully!");
}

function escapeRegex(string) {
  return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

run().catch(console.error);
