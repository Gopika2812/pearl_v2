import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Product from '../models/Product.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

mongoose.connect(process.env.MONGO_URI).then(async () => {
  console.log('Finding products with negative margins...');
  const products = await Product.find({ margin: { $lt: 0 } }).lean();
  
  if (products.length === 0) {
    console.log('No products with negative margins found.');
  } else {
    console.log(`Found ${products.length} products with negative margins:`);
    products.forEach(p => {
      console.log(`- Product: ${p.name} (${p._id})`);
      console.log(`  P-Price: ₹${p.purchasingPrice}, S-Price: ₹${p.sellingPrice}, Margin: ₹${p.margin}`);
      if (p.priceHistory && p.priceHistory.length > 0) {
        console.log(`  Last 2 History entries:`);
        p.priceHistory.slice(-2).forEach(h => {
          console.log(`    * ${h.effectiveDate.toISOString().split('T')[0]} | P: ${h.oldPurchasingPrice}->${h.newPurchasingPrice} | S: ${h.oldSellingPrice}->${h.newSellingPrice} | Source: ${h.sourceVoucher}`);
        });
      }
    });
  }
  process.exit();
}).catch(err => {
  console.error(err);
  process.exit(1);
});
