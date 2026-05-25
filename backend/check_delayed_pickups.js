import "./config/env.js";
import mongoose from "mongoose";
import Invoice from "./models/Invoice.js";
import Branch from "./models/Branch.js";

async function checkDelayed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 50);

    const goLiveDate = new Date("2026-05-20T00:00:00+05:30");

    const query = {
      deliveryStatus: { $in: ["PENDING", "PICKED"] },
      status: { $in: ["FINALIZED", "PRINTED", "SENT"] },
      $or: [
        { invoiceDate: { $exists: true, $lt: cutoff } },
        { invoiceDate: { $exists: false }, createdAt: { $lt: cutoff } }
      ],
      createdAt: { $gte: goLiveDate }
    };

    const invoices = await Invoice.find(query)
      .populate("branchId", "name code")
      .sort({ createdAt: 1 });

    console.log(`\nFound ${invoices.length} delayed invoices:`);
    invoices.forEach((inv, index) => {
      const date = inv.invoiceDate || inv.createdAt;
      const hoursAgo = Math.round((new Date() - new Date(date)) / (1000 * 60 * 60));
      console.log(`--- [${index + 1}] ---`);
      console.log(`Invoice No: ${inv.invoiceNumber}`);
      console.log(`Customer  : ${inv.customer?.name}`);
      console.log(`Branch    : ${inv.branchId?.name} (${inv.branchId?.code})`);
      console.log(`Date      : ${date.toISOString()}`);
      console.log(`Created   : ${inv.createdAt.toISOString()}`);
      console.log(`Status    : ${inv.status}`);
      console.log(`Deliv Stat: ${inv.deliveryStatus}`);
      console.log(`Age       : ${hoursAgo} hours ago`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkDelayed();
