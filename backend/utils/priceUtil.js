import Product from "../models/Product.js";
import mongoose from "mongoose";

/**
 * ⚡ CENTRALIZED PRICING SYNC UTILITY
 * This function updates product purchasing prices based on invoice items 
 * and triggers cascading syncs to customer locked prices.
 */
export const updateProductCostsFromInvoice = async (items, sourceVoucher, isReInvoice = false) => {
  if (!items || !Array.isArray(items)) return;

  console.log(`📡 [PRICE_SYNC] Triggering cost sync for voucher: ${sourceVoucher}`);
  const isPO = sourceVoucher.startsWith("PO");

  for (const item of items) {
    if (!item.productId) continue;

    try {
      const product = await Product.findById(item.productId);
      if (!product) continue;

      const newPPrice = Math.round((Number(item.purchasePrice) || 0) * 100) / 100;
      const oldPPrice = Number(product.purchasingPrice) || 0;
      
      const newGst = Number(item.gst) || 0;
      const oldGst = Number(product.gst) || 0;

      const priceChanged = newPPrice > 0 && newPPrice !== oldPPrice;
      const gstChanged = newGst !== oldGst;

      if (priceChanged || gstChanged) {
        const oldSPrice = product.sellingPrice || 0;

        if (priceChanged) product.purchasingPrice = newPPrice;
        if (gstChanged) product.gst = newGst;

        // 1. Save Master Product (Triggers margin calculations in Product.js)
        await product.save(); 

        // 2. Log to History
        const alreadyLogged = (product.priceHistory || []).some(h => h.sourceVoucher === sourceVoucher);
        if (!alreadyLogged) {
          product.priceHistory.push({
            oldPurchasingPrice: oldPPrice,
            newPurchasingPrice: newPPrice,
            oldSellingPrice: oldSPrice,
            newSellingPrice: product.sellingPrice,
            oldGst: oldGst,
            newGst: newGst,
            effectiveDate: new Date(),
            sourceVoucher: sourceVoucher,
            type: oldPPrice === 0 ? "INITIAL" : (newPPrice > oldPPrice ? "INCREASE" : "DECREASE"),
            note: isPO 
              ? (isReInvoice ? `Updated via Purchase Order Edit ${sourceVoucher}` : `Updated via Purchase Order ${sourceVoucher}`)
              : (isReInvoice ? `Updated via Purchase Invoice Edit ${sourceVoucher}` : `Updated via Purchase Invoice ${sourceVoucher}`)
          });
          await product.save();
        }

        // 3. ⚡ EXPLICIT CASCADING SYNC (Bypassing Hooks for Reliability)
        if (priceChanged) {
          const CustomerLockedPrice = mongoose.models.CustomerLockedPrice || mongoose.model("CustomerLockedPrice");
          const lockedPrices = await CustomerLockedPrice.find({ productId: product._id });
          
          if (lockedPrices.length > 0) {
            console.log(`   🔗 [PRICE_SYNC] Syncing ${lockedPrices.length} locked prices for [${product.name}]`);
            const bulkOps = lockedPrices.map(lp => {
              // 📈 PERCENTAGE SYNC LOGIC:
              // 1. Get the margin percentage (Recover from absolute margin if missing)
              let mPct = lp.marginPercentage;
              
              if (mPct === undefined || mPct === null || mPct === 0) {
                const referenceCost = lp.purchasingPrice || oldPPrice;
                const referenceMargin = (lp.margin !== undefined && lp.margin !== null) ? lp.margin : (lp.lockedPrice - referenceCost);
                mPct = referenceCost > 0 ? (referenceMargin / referenceCost) * 100 : 0;
              }

              // 2. Calculate New Price: New Cost + (New Cost * Margin %)
              const newLockedPrice = Math.round((newPPrice + (newPPrice * mPct / 100)) * 100) / 100;
              const newAbsoluteMargin = Math.round((newLockedPrice - newPPrice) * 100) / 100;
              
              return {
                updateOne: {
                  filter: { _id: lp._id },
                  update: { 
                    $set: { 
                      lockedPrice: newLockedPrice, 
                      purchasingPrice: newPPrice,
                      margin: newAbsoluteMargin,
                      marginPercentage: Math.round(mPct * 100) / 100
                    } 
                  }
                }
              };
            });
            await CustomerLockedPrice.bulkWrite(bulkOps);
          }
        }
      }
    } catch (err) {
      console.error(`❌ [PRICE_SYNC] Error syncing product [${item.name}]:`, err.message);
    }
  }
};
