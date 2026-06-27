const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' }); // Adjust if needed

const Product = require('./models/Product'); // Adjust path if needed

async function checkMargins() {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/pearls_erp");
    console.log("Connected to DB.");

    const products = await Product.find({});
    let mismatchCount = 0;

    for (let p of products) {
      if (p.purchasingPrice > 0 && p.sellingPrice > 0) {
        const expectedMargin = ((p.sellingPrice - p.purchasingPrice) / p.purchasingPrice) * 100;
        const currentMargin = p.marginPercentage || 0;
        
        // Check if mismatch is greater than a small tolerance (e.g. 0.01%)
        if (Math.abs(expectedMargin - currentMargin) > 0.1) {
          mismatchCount++;
          console.log(`Product: ${p.name}`);
          console.log(`  Purchasing Price: ${p.purchasingPrice}`);
          console.log(`  Saved Selling Price: ${p.sellingPrice}`);
          console.log(`  Current Margin: ${currentMargin.toFixed(2)}%`);
          console.log(`  Expected Margin to reach Selling Price: ${expectedMargin.toFixed(2)}%\n`);
        }
      }
    }
    
    console.log(`Total products with mismatched margins: ${mismatchCount}`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkMargins();
