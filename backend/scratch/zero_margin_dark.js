import mongoose from 'mongoose';
import '../config/env.js';
import CustomerLockedPrice from '../models/CustomerLockedPrice.js';
import Product from '../models/Product.js';

async function zero() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const p = await Product.findOne({
      name: /DARK COMPOUND 500GM \(1\*20\)/i, 
      branchId: new mongoose.Types.ObjectId('69cb755611501727ed6ec9cb')
    });
    
    if (p) {
      const result = await CustomerLockedPrice.updateMany(
        { productId: p._id }, 
        { 
          $set: { 
            margin: 0, 
            lockedPrice: p.purchasingPrice, 
            purchasingPrice: p.purchasingPrice 
          } 
        }
      );
      console.log(`✅ Zeroed margins for ${result.modifiedCount} locked prices of DARK COMPOUND.`);
    } else {
      console.log("Product not found.");
    }
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}
zero();
