import "./config/env.js";
import mongoose from "mongoose";
import Invoice from "./models/Invoice.js";
import moment from "moment-timezone";

async function checkInvoices() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const id = "69d706e0ab3afa9298ac7d74"; // S.O.K Alangulam
    const branchId = "69cbaee6bc6c37f37b32554a"; // VAIRAM TENKASI

    const startStr = "2026-05-01";
    const endStr = "2026-06-16";

    const IST = "Asia/Kolkata";
    const start = moment.tz(startStr, IST).startOf("day").toDate();
    const end = moment.tz(endStr, IST).endOf("day").toDate();

    const financialYearStart = moment.tz("2026-04-01", IST).startOf("day").toDate();
    const effectiveStart = start < financialYearStart ? start : financialYearStart;

    console.log("effectiveStart:", effectiveStart);
    console.log("end:", end);

    const invoicesInRange = await Invoice.find({
      "customer.customerId": id,
      branchId: branchId,
      status: { $in: ["FINALIZED", "PRINTED", "SENT"] },
      $or: [
        { invoiceDate: { $gte: effectiveStart, $lte: end } },
        { invoiceDate: { $exists: false }, createdAt: { $gte: effectiveStart, $lte: end } }
      ]
    }).select("invoiceNumber status invoiceDate");

    console.log("Invoices found:", invoicesInRange.length);
    invoicesInRange.forEach(inv => {
      console.log(inv.invoiceNumber, inv.status, inv.invoiceDate);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

checkInvoices();
