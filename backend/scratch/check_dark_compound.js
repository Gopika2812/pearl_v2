import mongoose from 'mongoose';
import '../config/env.js';
import Product from '../models/Product.js';
import CustomerLockedPrice from '../models/CustomerLockedPrice.js';
import Customer from '../models/Customer.js';

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
      sellingPrice: product.sellingPrice,
      margin: product.margin
    });

    const lockedPrices = await CustomerLockedPrice.find({ productId: product._id }).populate('customerId', 'name');
    console.log(`Found ${lockedPrices.length} locked prices:`);
    
    lockedPrices.forEach(lp => {
      console.log(`- Customer: ${lp.customerId?.name || 'Unknown'}`);
      console.log(`  Locked Price: ${lp.lockedPrice}`);
      console.log(`  LP Purchasing Price: ${lp.purchasingPrice}`);
      console.log(`  LP Margin: ${lp.margin}`);
      const expected = Math.round((product.purchasingPrice + (lp.margin || 0)) * 100) / 100;
      console.log(`  Sync Check: ${lp.lockedPrice === expected ? "MATCH" : "MISMATCH (Expected " + expected + ")"} `);
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

check();
