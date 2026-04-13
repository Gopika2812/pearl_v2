/**
 * fix_duplicate_pi.js
 * 
 * ONE-TIME DATA REPAIR SCRIPT
 * Problem: A PO was invoiced twice (PI#1 and PI#2), causing products from
 * PI#1 to be double-stocked.
 * 
 * Fix Strategy:
 *   1. Find all POs that have MORE THAN ONE PurchaseInvoice
 *   2. Keep only the LATEST PI (PI#2 - the complete one)
 *   3. Subtract stock quantities that were added by PI#1 (to remove the duplicate)
 *   4. Delete PI#1 from the database
 *   5. Ensure the PO's purchaseInvoiceId points to the latest PI
 * 
 * Run: node fix_duplicate_pi.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, "backend", ".env") });

const MONGO_URI = process.env.MONGO_URI;

// ─── Minimal Schemas ───────────────────────────────────────────────────────
const PurchaseInvoiceSchema = new mongoose.Schema({}, { strict: false });
const PurchaseOrderSchema    = new mongoose.Schema({}, { strict: false });
const ProductSchema          = new mongoose.Schema({}, { strict: false });

const PurchaseInvoice = mongoose.model("PurchaseInvoice", PurchaseInvoiceSchema, "purchaseinvoices");
const PurchaseOrder   = mongoose.model("PurchaseOrder",   PurchaseOrderSchema,   "purchaseorders");
const Product         = mongoose.model("Product",         ProductSchema,         "products");

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB\n");

  // 1. Find all POs that have more than one PI
  const pis = await PurchaseInvoice.find({}).lean();

  // Group by purchaseOrderId
  const pisByPO = {};
  for (const pi of pis) {
    const poId = pi.purchaseOrderId?.toString();
    if (!poId) continue;
    if (!pisByPO[poId]) pisByPO[poId] = [];
    pisByPO[poId].push(pi);
  }

  const duplicatePOs = Object.entries(pisByPO).filter(([, piList]) => piList.length > 1);

  if (duplicatePOs.length === 0) {
    console.log("✅ No duplicate PIs found! Database is clean.");
    await mongoose.disconnect();
    return;
  }

  console.log(`⚠️  Found ${duplicatePOs.length} PO(s) with duplicate PIs:\n`);

  for (const [poId, piList] of duplicatePOs) {
    const po = await PurchaseOrder.findById(poId).lean();
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📦 PO: ${po?.invoiceId || poId}`);
    console.log(`   Total PIs found: ${piList.length}`);

    // Sort by createdAt ascending → oldest first
    piList.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    piList.forEach((pi, i) => {
      console.log(`   PI #${i+1}: ${pi.purchaseInvoiceId} | Items: ${pi.items?.length || 0} | Grand Total: ₹${pi.grandTotal} | Created: ${pi.createdAt}`);
      pi.items?.forEach(item => {
        console.log(`      - ${item.name} | qty: ${item.qty}`);
      });
    });

    // Keep the LATEST PI, delete all older ones
    const latestPI  = piList[piList.length - 1];     // Keep this
    const oldPIs    = piList.slice(0, piList.length - 1); // Delete these

    console.log(`\n   ✅ KEEPING:  ${latestPI.purchaseInvoiceId}`);
    console.log(`   ❌ DELETING: ${oldPIs.map(p => p.purchaseInvoiceId).join(", ")}`);

    // 2. Build a map of items in OLD PIs to subtract from stock
    const stockToSubtract = {};  // productId → qty
    for (const oldPI of oldPIs) {
      for (const item of (oldPI.items || [])) {
        const pid = item.productId?.toString();
        if (!pid) continue;
        stockToSubtract[pid] = (stockToSubtract[pid] || 0) + Number(item.qty || 0);
      }
    }

    // But DON'T subtract items that are NOT in the latest PI
    // (those items were newly added in re-edit, and latest PI already has them once)
    const latestPids = new Set((latestPI.items || []).map(i => i.productId?.toString()));
    
    console.log(`\n   📉 Stock adjustments to make:`);
    for (const [pid, qty] of Object.entries(stockToSubtract)) {
      if (latestPids.has(pid)) {
        const prod = await Product.findById(pid).lean();
        console.log(`      - ${prod?.name || pid}: -${qty} (was double-added in old PI)`);
      } else {
        console.log(`      - Product ${pid}: SKIP (not in latest PI, avoiding negative stock)`);
      }
    }

    // Ask for confirmation
    console.log(`\n   ⚡ Applying fixes now...`);

    // 3. Apply stock subtraction for items that exist in BOTH old and new PI
    for (const [pid, qty] of Object.entries(stockToSubtract)) {
      if (!latestPids.has(pid)) continue; // skip if not in latest
      await Product.findByIdAndUpdate(pid, { $inc: { totalQty: -qty } });
      const prod = await Product.findById(pid).lean();
      console.log(`      ✅ Reduced ${prod?.name || pid} stock by ${qty}. New totalQty: ${prod?.totalQty}`);
    }

    // 4. Delete old PIs
    for (const oldPI of oldPIs) {
      await PurchaseInvoice.findByIdAndDelete(oldPI._id);
      console.log(`      🗑️  Deleted old PI: ${oldPI.purchaseInvoiceId}`);
    }

    // 5. Ensure PO points to the latest PI
    await PurchaseOrder.findByIdAndUpdate(poId, {
      purchaseInvoiceId: latestPI.purchaseInvoiceId,
      lastInvoicedItems: latestPI.items,
      lastInvoicedGrandTotal: latestPI.grandTotal,
      status: "INVOICED"
    });
    console.log(`      ✅ PO updated → purchaseInvoiceId = ${latestPI.purchaseInvoiceId}`);
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`\n🎉 DATA REPAIR COMPLETE!\n`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error("❌ Error:", err);
  mongoose.disconnect();
  process.exit(1);
});
