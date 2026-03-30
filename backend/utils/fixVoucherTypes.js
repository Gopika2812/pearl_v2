import mongoose from "mongoose";
import Branch from "../models/Branch.js";
import VoucherType from "../models/VoucherType.js";
import { getFinancialYear } from "./financialYear.js";

/**
 * Ensures that every branch has independent sequential counters for:
 * 1. Purchase Invoices (PI)
 * 2. Sales Invoices (SI)
 * 
 * This decouples invoice numbering from order numbering.
 */
export const fixVoucherTypes = async () => {
  try {
    console.log("🔧 Initializing Purchase and Sales Invoice counters...");
    const branches = await Branch.find({});
    const financialYear = getFinancialYear();

    for (const branch of branches) {
      console.log(`  Processing branch: ${branch.name} (${branch.code})`);

      // 1. Ensure Purchase Invoice (PI) Voucher Type
      const existingPI = await VoucherType.findOne({
        branchId: branch._id,
        orderType: "PI",
        financialYear
      });

      if (!existingPI) {
        // Try to find a Purchase Order (PO) voucher to copy prefix settings
        const poVoucher = await VoucherType.findOne({
          branchId: branch._id,
          orderType: "PO"
        }) || { name: "purchasegst", prefix: `${branch.code}PI` };

        const piPrefix = poVoucher.prefix.replace("PO", "PI");
        const finalPiPrefix = piPrefix === poVoucher.prefix ? `${piPrefix}PI` : piPrefix;

        const newPI = new VoucherType({
          branchId: branch._id,
          name: poVoucher.name.replace("po", "pi").replace("order", "invoice") || "purchaseinvoice",
          orderType: "PI",
          prefix: finalPiPrefix,
          counter: 1,
          financialYear
        });
        await newPI.save();
        console.log(`    ✅ Created PI counter for ${branch.name}: ${finalPiPrefix}/001/...`);
      }

      // 2. Ensure Sales Invoice (SI) Voucher Type
      const existingSI = await VoucherType.findOne({
        branchId: branch._id,
        orderType: "SI",
        financialYear
      });

      if (!existingSI) {
        // Try to find a Sales Order (SO) voucher to copy prefix settings
        const soVoucher = await VoucherType.findOne({
          branchId: branch._id,
          orderType: "SO"
        }) || { name: "salesgst", prefix: `${branch.code}SI` };

        const siPrefix = soVoucher.prefix.replace("SO", "SI");
        const finalSiPrefix = siPrefix === soVoucher.prefix ? `${siPrefix}SI` : siPrefix;

        const newSI = new VoucherType({
          branchId: branch._id,
          name: soVoucher.name.replace("so", "si").replace("order", "invoice") || "salesinvoice",
          orderType: "SI",
          prefix: finalSiPrefix,
          counter: 1,
          financialYear
        });
        await newSI.save();
        console.log(`    ✅ Created SI counter for ${branch.name}: ${finalSiPrefix}/001/...`);
      }
    }

    console.log("✅ Invoice counters synchronized for all branches.");
  } catch (err) {
    console.error("❌ Error initializing invoice vouchers:", err.message);
  }
};

export default fixVoucherTypes;
