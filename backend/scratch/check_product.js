import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product.js';

dotenv.config({ path: '../.env' });

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const productName = "Morde Dark Compound 500gm";
    const product = await Product.findOne({ name: productName });
    if (product) {
        console.log('Product:', product.name);
        console.log('Quantity:', product.systemQty || product.qty || product.stock);
        console.log('Full Doc:', JSON.stringify(product, null, 2));
    } else {
        console.log('Product not found');
    }
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
