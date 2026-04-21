import mongoose from 'mongoose';
import '../config/env.js';
import Product from '../models/Product.js';
import CustomerLockedPrice from '../models/CustomerLockedPrice.js';

async function testSync() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB");

    const productName = "DARK COMPOUND 500GM (1*20)";
    const product = await Product.findOne({ name: { $regex: new RegExp(productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } });
    if (!product) {
      console.log("Product not found");
      return;
    }

    const oldCost = product.purchasingPrice;
    const newCost = Math.round((oldCost + 10) * 100) / 100;
    console.log(`Current Cost: ${oldCost}, Updating to: ${newCost}`);

    // Test Case 1: Single Update via findByIdAndUpdate (with new: true)
    console.log("--- Testing Single Update Sync (with new: true) ---");
    await Product.findByIdAndUpdate(product._id, { purchasingPrice: newCost }, { new: true });
    
    let lp = await CustomerLockedPrice.findOne({ productId: product._id });
    if (!lp) throw new Error("Locked price record not found for testing!");

    console.log(`Updated Locked Price: ${lp.lockedPrice} (Expected: ${Math.round((newCost + lp.margin) * 100) / 100})`);
    const s1 = lp.lockedPrice === Math.round((newCost + lp.margin) * 100) / 100;
    console.log(`Sync Status: ${s1 ? "SUCCESS" : "FAILED"}`);

    // Test Case 2: Bulk Update Simulation
    console.log("--- Testing Bulk Update Sync Simulation ---");
    const bulkNewCost = Math.round((oldCost + 20) * 100) / 100;
    const productsToBulkUpdate = [
        {
            updateOne: {
                filter: { _id: product._id },
                update: { $set: { purchasingPrice: bulkNewCost } }
            }
        }
    ];
    
    // Simulate what's in productRoutes.js
    await Product.bulkWrite(productsToBulkUpdate);
    const updatedProductIds = productsToBulkUpdate.map(op => op.updateOne.filter._id);
    console.log(`📡 Bulk Sync: Triggering price sync for ${updatedProductIds.length} products...`);
    const updatedProducts = await Product.find({ _id: { $in: updatedProductIds } });
    
    for (const p of updatedProducts) {
      const lockedPrices = await CustomerLockedPrice.find({ productId: p._id });
      if (lockedPrices.length > 0) {
        const lpOps = lockedPrices.map(lp => ({
          updateOne: {
            filter: { _id: lp._id },
            update: { 
              $set: { 
                lockedPrice: Math.round((p.purchasingPrice + (lp.margin || 0)) * 100) / 100,
                purchasingPrice: p.purchasingPrice 
              } 
            }
          }
        }));
        await CustomerLockedPrice.bulkWrite(lpOps);
        console.log(`   ✅ Synced ${lockedPrices.length} locked prices for [${p.name}]`);
      }
    }

    lp = await CustomerLockedPrice.findOne({ productId: product._id });
    console.log(`Updated Locked Price (Bulk): ${lp.lockedPrice} (Expected: ${Math.round((bulkNewCost + lp.margin) * 100) / 100})`);
    const s2 = lp.lockedPrice === Math.round((bulkNewCost + lp.margin) * 100) / 100;
    console.log(`Bulk Sync Status: ${s2 ? "SUCCESS" : "FAILED"}`);


    // Reset
    await Product.findByIdAndUpdate(product._id, { purchasingPrice: oldCost }, { new: true });

    await mongoose.disconnect();
    console.log("Tests finished.");
    process.exit((s1 && s2) ? 0 : 1);
  } catch (err) {
    console.error("Test Error:", err);
    process.exit(1);
  }
}

testSync();
