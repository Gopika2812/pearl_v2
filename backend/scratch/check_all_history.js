import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({path: '../.env'});
import Product from '../models/Product.js';

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const p = await Product.find({});
  let foundHistory = false;
  for (const prod of p) {
    if (prod.priceHistory && prod.priceHistory.length > 0) {
      console.log("Product:", prod.name);
      console.log("History length:", prod.priceHistory.length);
      console.log(JSON.stringify(prod.priceHistory[0], null, 2));
      foundHistory = true;
      break;
    }
  }
  if (!foundHistory) {
    console.log("NO PRODUCT HAS PRICE HISTORY");
  } else {
    // try to find CNG Grains Foro
    const cnc = p.filter(p => p.name.includes("Foro"));
    console.log("Products with Foro:", cnc.map(c => ({name: c.name, hasHistory: c.priceHistory?.length > 0})));
  }
  process.exit();
}).catch(console.error);
