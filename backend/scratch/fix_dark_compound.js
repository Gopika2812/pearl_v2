import mongoose from 'mongoose';
import '../config/env.js';
import Product from '../models/Product.js';
import CustomerLockedPrice from '../models/CustomerLockedPrice.js';

async function fixDarkCompound() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB");

    const productName = "DARK COMPOUND 500GM (1*20)";
    const product = await Product.findOne({
      name: { $regex: new RegExp(productName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      branchId: new mongoose.Types.ObjectId('69cb755611501727ed6ec9cb') // Pearl Agency
    });

    if (!product) {
      console.log("Product not found in this branch");
      return;
    }

    console.log(`Current Price: ${product.purchasingPrice}, Fixing to: 143.07`);
    
    // Setting purchasingPrice will trigger the cascading sync in Product.js
    product.purchasingPrice = 143.07;
    await product.save();

    console.log("✅ Success! Fixed cost for DARK COMPOUND and synced all locked prices.");

    await mongoose.disconnect();
  } catch (err) {
    console.error("Fix Error:", err);
  }
}

fixDarkCompound();
