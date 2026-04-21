import Product from "../models/Product.js";

/**
 * ⚡ CENTRALIZED PRICING SYNC UTILITY
 * This function updates product purchasing prices based on invoice items 
 * and triggers cascading syncs to customer locked prices.
 * 
 * @param {Array} items - The items array from a Purchase Invoice/Order
 * @param {string} sourceVoucher - The Invoice ID (e.g., PI/080/26-27)
 * @param {boolean} isReInvoice - Whether this is a modification of an existing invoice
 */
export const updateProductCostsFromInvoice = async (items, sourceVoucher, isReInvoice = false) => {
  if (!items || !Array.isArray(items)) return;

  console.log(`📡 [PRICE_SYNC] Triggering cost sync for voucher: ${sourceVoucher}`);

  for (const item of items) {
    if (!item.productId) continue;

    try {
      const product = await Product.findById(item.productId);
      if (!product) {
        console.warn(`⚠️ [PRICE_SYNC] Product not found: ${item.productId} [${item.name}]`);
        continue;
      }

      // 1. Calculate the New Purchase Price
      // Note: We use purchasePrice (unit cost) from the invoice item
      const newPPrice = Math.round((Number(item.purchasePrice) || 0) * 100) / 100;
      const oldPPrice = Number(product.purchasingPrice) || 0;

      // 2. Only sync if price changed and is valid
      if (newPPrice > 0 && newPPrice !== oldPPrice) {
        const oldSPrice = product.sellingPrice || 0;

        console.log(`   ✅ Updating [${product.name}]: ₹${oldPPrice} -> ₹${newPPrice}`);

        // Update the master product cost
        product.purchasingPrice = newPPrice;

        // Triggers margin maintainer in Product.js pre('save') 
        // AND Dynamic sync in Product.js post('save')
        await product.save(); 

        // 3. Log to History
        // Avoid duplicate history entries for the same voucher if re-invoicing
        const alreadyLogged = (product.priceHistory || []).some(h => h.sourceVoucher === sourceVoucher);
        
        if (!alreadyLogged) {
          product.priceHistory.push({
            oldPurchasingPrice: oldPPrice,
            newPurchasingPrice: newPPrice,
            oldSellingPrice: oldSPrice,
            newSellingPrice: product.sellingPrice,
            effectiveDate: new Date(),
            sourceVoucher: sourceVoucher,
            type: oldPPrice === 0 ? "INITIAL" : (newPPrice > oldPPrice ? "INCREASE" : "DECREASE"),
            note: isReInvoice ? `Updated via Re-Invoice ${sourceVoucher}` : `Updated via Purchase Invoice ${sourceVoucher}`
          });
          await product.save();
        }
      }
    } catch (err) {
      console.error(`❌ [PRICE_SYNC] Error syncing product [${item.name}]:`, err.message);
    }
  }
};
