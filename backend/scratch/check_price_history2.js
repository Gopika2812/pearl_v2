import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({path: '../.env'});
import Product from '../models/Product.js';

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const p = await Product.findOne({ name: { $regex: 'CNC Grains Foro L 1-5', $options: 'i' } });
  if (p) {
    console.log("Found product:", p.name);
    console.log("Price history:");
    console.log(JSON.stringify(p.priceHistory, null, 2));
    console.log("Current purchasingPrice:", p.purchasingPrice);
  } else {
    console.log("Product not found");
  }
  process.exit();
}).catch(console.error);
