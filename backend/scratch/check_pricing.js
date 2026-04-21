import mongoose from 'mongoose';
import '../config/env.js';
import Product from '../models/Product.js';
import Customer from '../models/Customer.js';
import CustomerLockedPrice from '../models/CustomerLockedPrice.js';

async function check() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB");

    const productName = "DARK COMPOUND 500GM (1*20)";
    const product = await Product.findOne({ name: { $regex: new RegExp(productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } });
    if (!product) {
      console.log("Product not found");
      return;
    }

    console.log("Product:", {
      id: product._id,
      name: product.name,
      purchasingPrice: product.purchasingPrice,
      sellingPrice: product.sellingPrice
    });

    const lockedPrices = await CustomerLockedPrice.find({ productId: product._id }).populate('customerId', 'name');
    console.log("Locked Prices count:", lockedPrices.length);
    lockedPrices.forEach(lp => {
      const expectedPrice = Math.round((product.purchasingPrice + (lp.margin || 0)) * 100) / 100;
      console.log("LP:", {
        customer: lp.customerId?.name || "Unknown",
        lockedPrice: lp.lockedPrice,
        purchasingPriceInLP: lp.purchasingPrice,
        margin: lp.margin,
        expectedIfSynced: expectedPrice,
        syncCheck: expectedPrice === lp.lockedPrice ? "MATCH" : "MISMATCH"
      });
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

check();
