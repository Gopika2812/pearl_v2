import mongoose from "mongoose";
import dotenv from "dotenv";
import SalesOrder from "../models/SalesOrder.js";

dotenv.config();

async function check() {
  try {
    const uri = process.env.MONGO_URI;
    await mongoose.connect(uri);
    
    console.log("🔍 Auditing Edit History Dates for all orders...");
    const orders = await SalesOrder.find({ "editHistory.0": { $exists: true } }).lean();

    let afterApril9 = 0;
    let beforeApril9 = 0;
    let missingDate = 0;

    orders.forEach(so => {
      so.editHistory.forEach(h => {
        if (!h.editedAt) {
          missingDate++;
        } else if (new Date(h.editedAt) >= new Date("2026-04-10")) {
          afterApril9++;
          if (afterApril9 < 10) console.log(`Order ${so.invoiceId} | Action: ${h.editType} | Date: ${h.editedAt}`);
        } else {
          beforeApril9++;
        }
      });
    });

    console.log(`\n📊 DATE SUMMARY:`);
    console.log(`- Entries After April 9: ${afterApril9}`);
    console.log(`- Entries Before April 9: ${beforeApril9}`);
    console.log(`- Missing Dates (using updatedAt fallback): ${missingDate}`);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
