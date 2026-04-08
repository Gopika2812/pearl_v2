import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from backend
dotenv.config({ path: path.join(__dirname, "backend", ".env") });

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ MONGO_URI not found in backend/.env");
  process.exit(1);
}

// Define Schemas (Simplified for the script)
const PurchaseItemSchema = new mongoose.Schema({
  productId: mongoose.Schema.Types.ObjectId,
  qty: Number,
  purchasePrice: Number,
  discountPercent: Number,
  discountAmount: Number,
  taxableAmount: Number,
  gst: Number,
  cgst: Number,
  sgst: Number,
  igst: Boolean,
  total: Number,
});

const PurchaseOrder = mongoose.model("PurchaseOrder", new mongoose.Schema({
  items: [PurchaseItemSchema],
  subtotal: Number,
  totalTax: Number,
  extraExpenseAmount: Number,
  grandTotal: Number,
  status: String,
  invoiceId: String,
}));

const PurchaseInvoice = mongoose.model("PurchaseInvoice", new mongoose.Schema({
  items: [PurchaseItemSchema],
  subtotal: Number,
  totalTax: Number,
  extraExpenseAmount: Number,
  grandTotal: Number,
  purchaseInvoiceId: String,
}));

async function fixData() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // 1. Fix Purchase Orders
    const pos = await PurchaseOrder.find({});
    console.log(`🔍 Found ${pos.length} Purchase Orders to check...`);

    for (const po of pos) {
      let needsUpdate = false;
      let totalTax = 0;
      let subtotal = 0;
      let totalDiscount = 0;

      for (const item of po.items) {
        const gross = (item.purchasePrice || 0) * (item.qty || 0);
        const dPercent = item.discountPercent || 0;
        const dAmount = Math.round((gross * dPercent / 100) * 100) / 100;
        const taxable = gross - dAmount;
        const gst = item.gst || 0;
        const tax = Math.round((taxable * gst / 100) * 100) / 100;

        // If cgst/sgst look like amounts, fix them to percentages
        if (item.cgst > 100 || (item.cgst === 0 && gst > 0 && !item.igst)) {
          item.cgst = gst / 2;
          item.sgst = gst / 2;
          needsUpdate = true;
        }

        // Populate new fields
        if (item.discountAmount !== dAmount || item.taxableAmount !== taxable) {
          item.discountAmount = dAmount;
          item.taxableAmount = taxable;
          needsUpdate = true;
        }

        subtotal += gross;
        totalDiscount += dAmount;
        totalTax += tax;
      }

      const extra = po.extraExpenseAmount || 0;
      const calcGrandTotal = Math.round(subtotal - totalDiscount + totalTax + extra);

      if (Math.round(po.totalTax) !== Math.round(totalTax) || Math.round(po.grandTotal) !== calcGrandTotal) {
        console.log(`🛠️ Fixing PO ${po.invoiceId}: Tax ${po.totalTax} -> ${Math.round(totalTax)}, GrandTotal ${po.grandTotal} -> ${calcGrandTotal}`);
        po.totalTax = Math.round(totalTax);
        po.grandTotal = calcGrandTotal;
        po.subtotal = Math.round(subtotal);
        needsUpdate = true;
      }

      if (needsUpdate) {
        await po.save();
      }
    }

    // 2. Fix Purchase Invoices
    const pis = await PurchaseInvoice.find({});
    console.log(`🔍 Found ${pis.length} Purchase Invoices to check...`);

    for (const pi of pis) {
      let needsUpdate = false;
      let totalTax = 0;
      let subtotal = 0;
      let totalDiscount = 0;

      for (const item of pi.items) {
        const gross = (item.purchasePrice || 0) * (item.qty || 0);
        const dPercent = item.discountPercent || 0;
        const dAmount = Math.round((gross * dPercent / 100) * 100) / 100;
        const taxable = gross - dAmount;
        const gst = item.gst || 0;
        const tax = Math.round((taxable * gst / 100) * 100) / 100;

        if (item.discountAmount !== dAmount) {
          item.discountAmount = dAmount;
          needsUpdate = true;
        }

        subtotal += gross;
        totalDiscount += dAmount;
        totalTax += tax;
      }

      const extra = pi.extraExpenseAmount || 0;
      const calcGrandTotal = Math.round(subtotal - totalDiscount + totalTax + extra);

      if (Math.round(pi.totalTax) !== Math.round(totalTax) || Math.round(pi.grandTotal) !== calcGrandTotal) {
        console.log(`🛠️ Fixing PI ${pi.purchaseInvoiceId}: Tax ${pi.totalTax} -> ${Math.round(totalTax)}, GrandTotal ${pi.grandTotal} -> ${calcGrandTotal}`);
        pi.totalTax = Math.round(totalTax);
        pi.grandTotal = calcGrandTotal;
        pi.subtotal = Math.round(subtotal);
        needsUpdate = true;
      }

      if (needsUpdate) {
        await pi.save();
      }
    }

    console.log("✅ Database fix complete!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Fix error:", err);
    process.exit(1);
  }
}

fixData();
