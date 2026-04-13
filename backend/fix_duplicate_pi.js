/**
 * fix_duplicate_pi.js
 * 
 * ONE-TIME DATA REPAIR SCRIPT
 * Problem: A PO was invoiced twice (PI#1 and PI#2), causing products from
 * PI#1 to be double-stocked.
 * 
 * Fix Strategy:
 *   1. Find all POs that have MORE THAN ONE PurchaseInvoice
 *   2. Keep only the LATEST PI (the complete one with all items)
 *   3. Subtract stock quantities that were added by older PI(s)
 *   4. Delete the older PI(s)
 *   5. Ensure the PO's purchaseInvoiceId points to the latest PI
 * 
 * Run from backend folder: node fix_duplicate_pi.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

// ─── Minimal Schemas (strict:false to avoid schema mismatch) ───────────────
const PurchaseInvoice = mongoose.model("PurchaseInvoice", new mongoose.Schema({}, { strict: false }), "purchaseinvoices");
const PurchaseOrder   = mongoose.model("PurchaseOrder",   new mongoose.Schema({}, { strict: false }), "purchaseorders");
const Product         = mongoose.model("Product",         new mongoose.Schema({}, { strict: false }), "products");

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB\n");

  // 1. Find all PIs grouped by purchaseOrderId
  const allPIs = await PurchaseInvoice.find({}).lean();

  const pisByPO = {};
  for (const pi of allPIs) {
    const poId = pi.purchaseOrderId?.toString();
    if (!poId) continue;
    if (!pisByPO[poId]) pisByPO[poId] = [];
    pisByPO[poId].push(pi);
  }

  const duplicatePOs = Object.entries(pisByPO).filter(([, list]) => list.length > 1);

  if (duplicatePOs.length === 0) {
    console.log("✅ No duplicate PIs found! Database is already clean.");
    await mongoose.disconnect();
    return;
  }

  console.log(`⚠️  Found ${duplicatePOs.length} PO(s) with DUPLICATE PIs:\n`);

  for (const [poId, piList] of duplicatePOs) {
    const po = await PurchaseOrder.findById(poId).lean();
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📦 PO: ${po?.invoiceId || poId}`);

    // Sort oldest first
    piList.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    piList.forEach((pi, i) => {
      console.log(`\n   PI #${i+1}: ${pi.purchaseInvoiceId} | Created: ${pi.createdAt}`);
      (pi.items || []).forEach(item =>
        console.log(`      - ${item.name || item.productId} | qty: ${item.qty}`)
      );
    });

    const latestPI = piList[piList.length - 1];    // Keep this one
    const oldPIs   = piList.slice(0, piList.length - 1); // Delete these

    console.log(`\n   ✅ KEEPING : ${latestPI.purchaseInvoiceId}`);
    console.log(`   ❌ DELETING: ${oldPIs.map(p => p.purchaseInvoiceId).join(", ")}`);

    // 2. Calculate which stock to subtract (items in OLD PIs that also exist in LATEST PI)
    //    Those items got stocked in OLD PI, then stocked AGAIN in LATEST PI → double stocked
    const latestPids = new Set((latestPI.items || []).map(i => i.productId?.toString()));

    const stockToSubtract = {};
    for (const oldPI of oldPIs) {
      for (const item of (oldPI.items || [])) {
        const pid = item.productId?.toString();
        if (!pid || !latestPids.has(pid)) continue; // skip items NOT in latest PI
        stockToSubtract[pid] = (stockToSubtract[pid] || 0) + Number(item.qty || 0);
      }
    }

    console.log(`\n   📉 STOCK CORRECTIONS:`);
    for (const [pid, qty] of Object.entries(stockToSubtract)) {
      const prod = await Product.findById(pid).lean();
      console.log(`      - ${prod?.name || pid}: REDUCE by ${qty} (was double-added)`);
    }

    // 3. Apply stock corrections
    for (const [pid, qty] of Object.entries(stockToSubtract)) {
      await Product.findByIdAndUpdate(pid, { $inc: { totalQty: -qty } });
    }
    console.log(`\n   ✅ Stock corrected`);

    // 4. Delete old PIs
    for (const oldPI of oldPIs) {
      await PurchaseInvoice.findByIdAndDelete(oldPI._id);
      console.log(`   🗑️  Deleted old PI: ${oldPI.purchaseInvoiceId}`);
    }

    // 5. Update PO to reference latest PI
    await PurchaseOrder.findByIdAndUpdate(poId, {
      purchaseInvoiceId: latestPI.purchaseInvoiceId,
      lastInvoicedItems: latestPI.items,
      lastInvoicedGrandTotal: latestPI.grandTotal,
      status: "INVOICED"
    });
    console.log(`   ✅ PO now correctly references: ${latestPI.purchaseInvoiceId}\n`);
  }

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`\n🎉 DATA REPAIR COMPLETE!\n`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error("❌ Error:", err.message);
  mongoose.disconnect();
  process.exit(1);
});
