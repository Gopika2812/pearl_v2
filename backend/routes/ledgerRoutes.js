import express from "express";
import multer from "multer";
import XLSX from "xlsx";
import Ledger from "../models/Ledger.js";
import LedgerGroup from "../models/LedgerGroup.js";
import auth from "../middleware/auth.js";
import mongoose from "mongoose";


const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * GET: Fetch All Ledgers for a Branch
 */
router.get("/", auth, async (req, res) => {
  try {
    const { branchId, groupId, search } = req.query;

    // Multi-tenancy check
    if (req.user.role !== "SUPER_ADMIN" && req.user.branch !== branchId) {
      return res.status(403).json({ message: "Unauthorized access to this branch's data" });
    }

    if (!branchId) {

      return res.status(400).json({ message: "branchId is required" });
    }

    const query = { branchId };
    if (groupId) query.groupId = groupId;
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const ledgers = await Ledger.find(query)
      .populate("groupId", "name nature")
      .sort({ name: 1 });

    res.json(ledgers);
  } catch (error) {
    console.error("Fetch Ledgers Error:", error);
    res.status(500).json({ message: "Failed to fetch ledgers" });
  }
});

/**
 * GET: Fetch All Ledger Groups
 */
router.get("/groups", auth, async (req, res) => {
  try {
    const { branchId, nature } = req.query;

    // Multi-tenancy check
    if (req.user.role !== "SUPER_ADMIN" && req.user.branch !== branchId) {
      return res.status(403).json({ message: "Unauthorized access to this branch's data" });
    }

    if (!branchId) {

      return res.status(400).json({ message: "branchId is required" });
    }

    const query = { branchId };
    if (nature) query.nature = nature;

    const groups = await LedgerGroup.find(query).sort({ name: 1 });
    res.json(groups);
  } catch (error) {
    console.error("Fetch Groups Error:", error);
    res.status(500).json({ message: "Failed to fetch groups" });
  }
});

/**
 * POST: Create a New Ledger Group
 */
router.post("/groups", auth, async (req, res) => {
  try {
    const { name, nature, branchId, description } = req.body;

    // Multi-tenancy check
    if (req.user.role !== "SUPER_ADMIN" && req.user.branch !== branchId) {
      return res.status(403).json({ message: "Unauthorized access to this branch's data" });
    }

    if (!name || !nature || !branchId) {

      return res.status(400).json({ message: "Name, Nature, and branchId are required" });
    }

    const existing = await LedgerGroup.findOne({ branchId, name: { $regex: `^${name}$`, $options: "i" } });
    if (existing) {
      return res.status(400).json({ message: "Ledger group already exists" });
    }

    const group = new LedgerGroup({ name, nature, branchId, description });
    await group.save();

    res.status(201).json(group);
  } catch (error) {
    console.error("Create Group Error:", error);
    res.status(500).json({ message: "Failed to create ledger group" });
  }
});

/**
 * POST: Create a New Ledger
 */
router.post("/", auth, async (req, res) => {
  try {
    const { name, groupId, branchId, gst, gstin, hsn, openingDebit, openingCredit, notes } = req.body;

    // Multi-tenancy check
    if (req.user.role !== "SUPER_ADMIN" && req.user.branch !== branchId) {
      return res.status(403).json({ message: "Unauthorized access to this branch's data" });
    }

    if (!name || !groupId || !branchId) {

      return res.status(400).json({ message: "Name, groupId, and branchId are required" });
    }

    const existing = await Ledger.findOne({ branchId, name: { $regex: `^${name}$`, $options: "i" } });
    if (existing) {
      return res.status(400).json({ message: "Ledger with this name already exists" });
    }

    const currentBalance = (Number(openingDebit) || 0) - (Number(openingCredit) || 0);

    const ledger = new Ledger({
      name,
      groupId,
      branchId,
      gst: Number(gst) || 0,
      gstin,
      hsn,
      openingDebit: Number(openingDebit) || 0,
      openingCredit: Number(openingCredit) || 0,
      currentBalance,
      notes,
    });

    await ledger.save();
    res.status(201).json(ledger);
  } catch (error) {
    console.error("Create Ledger Error:", error);
    res.status(500).json({ message: "Failed to create ledger" });
  }
});

/**
 * POST: Bulk Upload Ledgers (Migration)
 */
router.post("/bulk-upload", auth, upload.single("file"), async (req, res) => {
  try {
    const { branchId } = req.body;

    // Multi-tenancy check
    if (req.user.role !== "SUPER_ADMIN" && req.user.branch !== branchId) {
      return res.status(403).json({ message: "Unauthorized access to this branch's data" });
    }

    if (!branchId || !req.file) {
      return res.status(400).json({ message: "branchId and Excel file are required" });
    }

    // Cast branchId to ensure Mongoose compatibility
    let validBranchId;
    try {
      validBranchId = new mongoose.Types.ObjectId(branchId);
    } catch (e) {
      return res.status(400).json({ message: "Invalid branchId format" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    let bestSheet = null;
    let bestHeaderMap = {};
    let bestHeaderRowIndex = -1;
    let bestDataRows = [];
    let diagnostics = [];

    // Helper Keywords
    const nameKeywords = ["accountname", "ledgername", "name", "ledger", "account", "ledgerdetails", "accounttitle", "particluars", "particulars", "partyname"];
    const groupKeywords = ["accountgroup", "ledgergroup", "group", "accounttype", "category", "parent", "head", "undergroup", "under"];

    // 1. Scan ALL Sheets to find the one with the most data
    for (const sheetName of workbook.SheetNames) {
      const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
      if (!rawData || rawData.length === 0) continue;

      let foundHeaderIndex = -1;
      let foundHeaderMap = {};

      // Scan first 30 rows for headers
      for (let i = 0; i < Math.min(rawData.length, 30); i++) {
        const row = rawData[i];
        if (!row || !Array.isArray(row) || row.length === 0) continue;
        
        const normalizedRow = row.map(cell => String(cell || "").toLowerCase().replace(/[^a-z0-9]/g, ""));
        
        const hasName = normalizedRow.some(cell => nameKeywords.includes(cell));
        const hasGroup = normalizedRow.some(cell => groupKeywords.includes(cell));

        if (hasName || hasGroup) {
          foundHeaderIndex = i;
          normalizedRow.forEach((key, idx) => {
            if (key) foundHeaderMap[key] = idx;
          });
          break;
        }
      }

      const rowsFound = rawData.length - (foundHeaderIndex + 1);
      diagnostics.push({ sheetName, headerFound: foundHeaderIndex !== -1, rows: rowsFound });

      if (foundHeaderIndex !== -1 && rowsFound > (bestDataRows.length || 0)) {
        bestSheet = sheetName;
        bestHeaderRowIndex = foundHeaderIndex;
        bestHeaderMap = foundHeaderMap;
        bestDataRows = rawData.slice(foundHeaderIndex + 1);
      }
    }

    if (!bestSheet || bestDataRows.length === 0) {
      return res.status(400).json({ 
        message: "No valid data sheet found. Please ensure your Excel file has columns like 'Account Name' and 'Account Group'.",
        diagnostics,
        expectedHeaders: { name: nameKeywords, group: groupKeywords }
      });
    }

    const allGroups = await LedgerGroup.find({ branchId });
    const groupMap = new Map(allGroups.map(g => [g.name.toLowerCase().trim(), g._id]));

    let createdCount = 0;
    let skippedCount = 0;
    let errors = [];

    for (const [index, row] of bestDataRows.entries()) {
      try {
        if (!row || row.length === 0 || row.every(cell => !cell)) continue;

        const getVal = (aliases) => {
          for (const alias of aliases) {
            const normalizedAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, "");
            const colIdx = bestHeaderMap[normalizedAlias];
            if (colIdx !== undefined) {
              const val = row[colIdx];
              return val !== undefined && val !== null ? String(val).trim() : "";
            }
          }
          return "";
        };

        const name = getVal(nameKeywords);
        const groupName = getVal(groupKeywords);
        const nature = getVal(["nature", "type"]) || "Expense";
        const gstString = getVal(["gst", "gstpercent", "tax", "gstper", "gstrate", "gstn"]);
        const gst = parseFloat(gstString) || 0;
        const gstin = getVal(["gstinpan", "gstin", "pan", "gstnumber", "gstno", "gstintin", "gstinuin", "gstin/uin"]);
        const hsn = getVal(["hsn", "hsncode", "hsnac", "sac"]);
        const openingDebit = parseFloat(getVal(["openingdr", "dr", "debit", "openingdebit", "drbalance", "amountdr", "openingbalance"])) || 0;
        const openingCredit = parseFloat(getVal(["openingcr", "cr", "credit", "openingcredit", "crbalance", "amountcr"])) || 0;
        const notes = getVal(["notes", "narration", "description", "remarks", "memo"]);
        
        const contactPerson = getVal(["contactperson", "contact", "person", "contactname", "vendorname"]);
        // Combined phone number detection
        const phone = [
          getVal(["whatsapp"]),
          getVal(["mobile", "mobileno", "contactno"]),
          getVal(["phone", "phoneno", "telephoneno", "cell"])
        ].filter(v => v).join(", ") || "";
        
        const email = getVal(["email", "mailid", "emailaddress"]);
        const address = getVal(["address", "location", "fulladdress"]);
        const city = getVal(["city", "town", "district"]);
        const state = getVal(["state", "region", "province", "statename"]);
        const pincode = getVal(["pincode", "zip", "zipcode", "postcode"]);
        const country = getVal(["country", "nation"]) || "India";
        const registrationType = getVal(["registrationtype", "gsttype", "taxregistration", "gstregistrationtype"]);
        const pan = getVal(["pan", "panno", "incometaxno", "panitno"]);

        if (!name || !groupName) {
          skippedCount++;
          const reason = !name && !groupName ? "Name and Group missing" : !name ? "Name missing" : "Group missing";
          errors.push({ 
            row: index + bestHeaderRowIndex + 2, 
            reason: `${reason}. Detected headers: ${Object.keys(bestHeaderMap).join(", ")}`,
            data: row.slice(0, 5) // Show first 5 columns for debugging
          });
          continue;
        }

        // Handle Group Auto-Nature Detection
        let detectedNature = nature;
        if (!getVal(["nature", "type"])) {
          const gn = groupName.toLowerCase();
          if (gn.includes("debtor") || gn.includes("bank") || gn.includes("cash") || gn.includes("asset") || gn.includes("stock")) {
            detectedNature = "Asset";
          } else if (gn.includes("creditor") || gn.includes("liability") || gn.includes("loan") || gn.includes("tax") || gn.includes("payable")) {
            detectedNature = "Liability";
          } else if (gn.includes("sale") || gn.includes("income") || gn.includes("revenue")) {
            detectedNature = "Income";
          } else if (gn.includes("purchase") || gn.includes("expense") || gn.includes("direct") || gn.includes("indirect")) {
            detectedNature = "Expense";
          }
        }
        
        let groupId = groupMap.get(groupName.toLowerCase().trim());
        if (!groupId) {
          const newGroup = new LedgerGroup({
            name: groupName,
            nature: detectedNature,
            branchId: validBranchId
          });
          const savedGroup = await newGroup.save();
          groupId = savedGroup._id;
          groupMap.set(groupName.toLowerCase().trim(), groupId);
        }

        // Create or Update Ledger
        const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const existingLedger = await Ledger.findOne({ 
          branchId: validBranchId, 
          name: { $regex: `^${escapedName}$`, $options: "i" } 
        });
        
        const currentBalance = openingDebit - openingCredit;

        const ledgerData = {
          groupId,
          gst,
          gstin,
          hsn,
          openingDebit,
          openingCredit,
          currentBalance,
          notes,
          contactPerson,
          phone,
          address,
          city,
          state,
          pincode,
          email,
          registrationType,
          country,
          pan,
          branchId: validBranchId,
        };
if (existingLedger) {
          Object.assign(existingLedger, ledgerData);
          await existingLedger.save();
        } else {
          const ledger = new Ledger({
            name,
            branchId,
            ...ledgerData,
          });
          await ledger.save();
        }
        createdCount++;
      } catch (err) {
        errors.push({ row: index + bestHeaderRowIndex + 2, error: err.message });
        skippedCount++;
      }
    }

    res.json({
      success: true,
      version: "3.6-DetailedErrors",
      foundInSheet: bestSheet,
      message: `Bulk upload completed: ${createdCount} created/updated, ${skippedCount} skipped.`,
      detectedHeaders: Object.keys(bestHeaderMap),
      lastErrors: errors.slice(-5).map(e => `Row ${e.row}: ${e.error || e.reason}`),
      diagnostics
    });

  } catch (error) {
    console.error("Bulk Upload Error:", error);
    res.status(500).json({ message: "Bulk upload failed", error: error.message });
  }
});

export default router;
