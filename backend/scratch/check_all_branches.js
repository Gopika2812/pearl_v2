import mongoose from 'mongoose';
import '../config/env.js';
import Product from '../models/Product.js';
import CustomerLockedPrice from '../models/CustomerLockedPrice.js';
import Branch from '../models/Branch.js';
import Customer from '../models/Customer.js'; // Ensure it's imported to register the schema

async function check() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB");

    const productName = "DARK COMPOUND 500GM (1*20)";
    const products = await Product.find({ name: { $regex: new RegExp(productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } }).populate('branchId', 'name');
    
    console.log(`Found ${products.length} products with that name.`);

    for (const product of products) {
        console.log(`--- Product in Branch: ${product.branchId?.name || 'Unknown'} (ID: ${product.branchId?._id}) ---`);
        console.log({
          id: product._id,
          purchasingPrice: product.purchasingPrice,
          sellingPrice: product.sellingPrice,
          margin: product.margin
        });

        const lockedPrices = await CustomerLockedPrice.find({ productId: product._id }).populate('customerId', 'name');
        console.log(`Found ${lockedPrices.length} locked prices:`);
        
        lockedPrices.forEach(lp => {
          console.log(`  - Customer: ${lp.customerId?.name || 'Unknown'}`);
          console.log(`    Locked Price: ${lp.lockedPrice}`);
          console.log(`    LP Purchasing Price: ${lp.purchasingPrice}`);
          console.log(`    LP Margin: ${lp.margin}`);
        });
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

check();
