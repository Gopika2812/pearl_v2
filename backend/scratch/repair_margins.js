import mongoose from 'mongoose';
import '../config/env.js';
import Product from '../models/Product.js';
import CustomerLockedPrice from '../models/CustomerLockedPrice.js';

async function repair() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB");

    const [lockedPrices, allProducts] = await Promise.all([
      CustomerLockedPrice.find({}),
      Product.find({}, { _id: 1, purchasingPrice: 1 })
    ]);

    console.log(`Found ${lockedPrices.length} records and ${allProducts.length} products.`);

    const productMap = new Map(allProducts.map(p => [p._id.toString(), p.purchasingPrice || 0]));

    const bulkOps = [];
    for (const lp of lockedPrices) {
      const currentCost = productMap.get(lp.productId.toString()) || 0;
      const currentLockedPrice = lp.lockedPrice || 0;
      
      // Calculate Absolute Margin: Price - Cost
      const margin = Math.round((currentLockedPrice - currentCost) * 100) / 100;

      bulkOps.push({
        updateOne: {
          filter: { _id: lp._id },
          update: { 
            $set: { 
              margin: margin,
              purchasingPrice: currentCost 
            } 
          }
        }
      });
    }

    if (bulkOps.length > 0) {
      console.log(`Executing bulk update for ${bulkOps.length} records...`);
      const result = await CustomerLockedPrice.bulkWrite(bulkOps);
      console.log(`✅ Successfully calibrated ${result.modifiedCount} records.`);
    } else {
      console.log("No records found.");
    }

    await mongoose.disconnect();
    console.log("Disconnected.");
  } catch (err) {
    console.error("Repair Error:", err);
  }
}

repair();
