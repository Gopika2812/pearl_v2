import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Models
import CreditNote from "../models/CreditNote.js";
import DebitNote from "../models/DebitNote.js";
import Customer from "../models/Customer.js";
import Vendor from "../models/Vendor.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error("❌ MONGO_URI not found in .env");
    process.exit(1);
}

async function repairNotes() {
    try {
        console.log("🔌 Connecting to MongoDB...");
        await mongoose.connect(MONGO_URI);
        console.log("✅ Connected!");

        // 1️⃣ Fix Credit Notes
        console.log("\n🔍 Checking Credit Notes for missing branchId...");
        const creditNotes = await CreditNote.find({ 
            $or: [
                { branchId: { $exists: false } },
                { branchId: null }
            ]
        });

        console.log(`📊 Found ${creditNotes.length} Credit Notes to repair.`);
        let cnFixed = 0;

        for (const cn of creditNotes) {
            try {
                const customer = await Customer.findById(cn.customer.customerId);
                if (customer && customer.branchId) {
                    cn.branchId = customer.branchId;
                    await cn.save();
                    cnFixed++;
                    console.log(`✅ Repaired CN: ${cn.creditNoteId} -> Branch: ${customer.branchId}`);
                } else {
                    console.warn(`⚠️ Could not find customer/branch for CN: ${cn.creditNoteId}`);
                }
            } catch (err) {
                console.error(`❌ Error repairing CN ${cn.creditNoteId}:`, err.message);
            }
        }

        // 2️⃣ Fix Debit Notes
        console.log("\n🔍 Checking Debit Notes for missing branchId...");
        const debitNotes = await DebitNote.find({ 
            $or: [
                { branchId: { $exists: false } },
                { branchId: null }
            ]
        });

        console.log(`📊 Found ${debitNotes.length} Debit Notes to repair.`);
        let dnFixed = 0;

        for (const dn of debitNotes) {
            try {
                const vendor = await Vendor.findById(dn.vendor.vendorId);
                if (vendor && vendor.branchId) {
                    dn.branchId = vendor.branchId;
                    await dn.save();
                    dnFixed++;
                    console.log(`✅ Repaired DN: ${dn.debitNoteId} -> Branch: ${vendor.branchId}`);
                } else {
                    console.warn(`⚠️ Could not find vendor/branch for DN: ${dn.debitNoteId}`);
                }
            } catch (err) {
                console.error(`❌ Error repairing DN ${dn.debitNoteId}:`, err.message);
            }
        }

        console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`🎉 REPAIR COMPLETE!`);
        console.log(`✅ Credit Notes Fixed: ${cnFixed}/${creditNotes.length}`);
        console.log(`✅ Debit Notes Fixed: ${dnFixed}/${debitNotes.length}`);
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    } catch (error) {
        console.error("❌ Fatal Error:", error.message);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

repairNotes();
