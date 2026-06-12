import Product from "../models/Product.js";
import mongoose from "mongoose";

/**
 * ⚡ CENTRALIZED PRICING SYNC UTILITY
 * This function updates product purchasing prices based on invoice items 
 * and triggers cascading syncs to customer locked prices.
 */
export const updateProductCostsFromInvoice = async (items, sourceVoucher, isReInvoice = false, user = null) => {
  if (!items || !Array.isArray(items)) return;

  console.log(`📡 [PRICE_SYNC] Triggering cost sync for voucher: ${sourceVoucher} | User: ${user?.username || "System"}`);
  const PurchaseOrder = mongoose.models.PurchaseOrder || mongoose.model("PurchaseOrder");
  const isPO = sourceVoucher.startsWith("PO") || sourceVoucher.includes("PO") || !!(await PurchaseOrder.exists({ invoiceId: sourceVoucher }));
  if (isPO) {
    console.log(`📡 [PRICE_SYNC] Skipping cost sync for PO voucher: ${sourceVoucher}`);
    return;
  }

  for (const item of items) {
    if (!item.productId) continue;
    if (item.isSample) {
      console.log(`[PRICE_SYNC] Skipping sample product: ${item.name}`);
      continue;
    }

    try {
      const product = await Product.findById(item.productId);
      if (!product) continue;

      const newPPrice = Math.round((Number(item.purchasePrice) || 0) * 100) / 100;
      const oldPPrice = Number(product.purchasingPrice) || 0;
      
      const newMPrice = Math.round((Number(item.marketCapPrice) || 0) * 100) / 100;
      const oldMPrice = Number(product.marketCapPrice) || 0;
      
      const newGst = Number(item.gst) || 0;
      const oldGst = Number(product.gst) || 0;

      const priceChanged = newPPrice > 0 && newPPrice !== oldPPrice;
      const mPriceChanged = newMPrice !== oldMPrice;
      const gstChanged = newGst !== oldGst;

      if (priceChanged || mPriceChanged || gstChanged) {
        const oldSPrice = product.sellingPrice || 0;

        if (priceChanged) product.purchasingPrice = newPPrice;
        if (mPriceChanged) product.marketCapPrice = newMPrice;
        if (gstChanged) product.gst = newGst;

        // 1. Save Master Product (Triggers margin calculations in Product.js)
        await product.save(); 

        // 2. Log to History
        const alreadyLogged = (product.priceHistory || []).some(h => h.sourceVoucher === sourceVoucher);
        if (!alreadyLogged) {
          product.priceHistory.push({
            oldPurchasingPrice: oldPPrice,
            newPurchasingPrice: newPPrice,
            oldMarketCapPrice: oldMPrice,
            newMarketCapPrice: newMPrice,
            oldSellingPrice: oldSPrice,
            newSellingPrice: product.sellingPrice,
            oldGst: oldGst,
            newGst: newGst,
            effectiveDate: new Date(),
            sourceVoucher: sourceVoucher,
            type: oldPPrice === 0 ? "INITIAL" : (newPPrice > oldPPrice || newMPrice > oldMPrice ? "INCREASE" : "DECREASE"),
            note: isPO 
              ? (isReInvoice ? `Updated via Purchase Order Edit ${sourceVoucher}` : `Updated via Purchase Order ${sourceVoucher}`)
              : (isReInvoice ? `Updated via Purchase Invoice Edit ${sourceVoucher}` : `Updated via Purchase Invoice ${sourceVoucher}`)
          });
          await product.save();
        }

        // 3. ⚡ EXPLICIT CASCADING SYNC
        if (priceChanged || mPriceChanged) {
          const CustomerLockedPrice = mongoose.models.CustomerLockedPrice || mongoose.model("CustomerLockedPrice");
          const lockedPrices = await CustomerLockedPrice.find({ productId: product._id });
          
          const baseCost = newMPrice > 0 ? newMPrice : newPPrice;
          const oldBaseCost = oldMPrice > 0 ? oldMPrice : oldPPrice;

          if (lockedPrices.length > 0) {
            console.log(`   🔗 [PRICE_SYNC] Syncing ${lockedPrices.length} locked prices for [${product.name}]`);
            const bulkOps = lockedPrices.map(lp => {
              // 📈 PERCENTAGE SYNC LOGIC:
              let mPct = lp.marginPercentage;
              
              if (mPct === undefined || mPct === null || mPct === 0) {
                const referenceCost = lp.purchasingPrice || oldBaseCost;
                const referenceMargin = (lp.margin !== undefined && lp.margin !== null) ? lp.margin : (lp.lockedPrice - referenceCost);
                mPct = referenceCost > 0 ? (referenceMargin / referenceCost) * 100 : 0;
              }

              // 2. Calculate New Price: New Cost + (New Cost * Margin %)
              const newLockedPrice = Math.round((baseCost + (baseCost * mPct / 100)) * 100) / 100;
              const newAbsoluteMargin = Math.round((newLockedPrice - baseCost) * 100) / 100;
              
              return {
                updateOne: {
                  filter: { _id: lp._id },
                  update: { 
                    $set: { 
                      lockedPrice: newLockedPrice, 
                      purchasingPrice: baseCost,
                      margin: newAbsoluteMargin,
                      marginPercentage: Math.round(mPct * 100) / 100,
                      updatedBy: user?.username || user?.name || "System",
                      updatedById: user?.id || user?._id || null,
                      updatedByModel: user?.role === "SUPER_ADMIN" ? "SuperAdmin" : (user ? "BranchUser" : undefined)
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
