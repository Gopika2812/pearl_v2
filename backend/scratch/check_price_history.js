const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('../models/Product.js').default || require('../models/Product.js');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const p = await Product.findOne({ name: { $regex: 'CNG Grains Foro L1-5', $options: 'i' } });
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
