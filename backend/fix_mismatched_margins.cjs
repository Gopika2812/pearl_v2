const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' }); 

let Product = require('./models/Product.js');
if (Product.default) {
  Product = Product.default;
}

async function fixMargins() {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/pearls_erp");
    console.log("Connected to DB.");

    const products = await Product.find({});
    let fixCount = 0;

    for (let p of products) {
      if (p.purchasingPrice > 0 && p.sellingPrice > 0) {
        const expectedMargin = ((p.sellingPrice - p.purchasingPrice) / p.purchasingPrice) * 100;
        const currentMargin = p.marginPercentage || 0;
        
        if (Math.abs(expectedMargin - currentMargin) > 0.1) {
          console.log(`Fixing: ${p.name}`);
          console.log(`  Purchasing: ${p.purchasingPrice} | Saved Selling: ${p.sellingPrice}`);
          console.log(`  Old Margin: ${currentMargin.toFixed(2)}% | New Margin: ${expectedMargin.toFixed(2)}%\n`);
          
          p.marginPercentage = expectedMargin;
          await p.save();
          fixCount++;
        }
      }
    }
    
    console.log(`Total products fixed: ${fixCount}`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

fixMargins();
