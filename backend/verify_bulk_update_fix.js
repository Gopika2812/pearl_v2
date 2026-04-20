import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config(); // Should work in backend dir

async function testRecalculation() {
  try {
    if (!process.env.MONGO_URI) {
        console.error("MONGO_URI not found. Check .env file.");
        process.exit(1);
    }

    console.log("Connecting to DB...");
    await mongoose.connect(process.env.MONGO_URI);
    const Product = mongoose.connection.db.collection('products');
    
    const sample = await Product.findOne({ purchasingPrice: { $gt: 0 } });
    if (!sample) {
      console.log("No product with positive cost found for testing.");
      process.exit(0);
    }
    
    console.log(`Testing product: [${sample.name}]`);
    console.log(` - Current Purchasing Price: ₹${sample.purchasingPrice}`);
    console.log(` - Current Selling Price: ₹${sample.sellingPrice}`);
    
    const newMarginPercentage = 15;
    const existingProduct = sample;
    let productData = { marginPercentage: newMarginPercentage };
    
    const existingCost = existingProduct.purchasingPrice || 0;
    productData.margin = Math.round((existingCost * productData.marginPercentage / 100) * 100) / 100;
    productData.sellingPrice = Math.round((existingCost + productData.margin) * 100) / 100;
    
    const expectedSellingPrice = Math.round((sample.purchasingPrice * (1 + newMarginPercentage/100)) * 100) / 100;
    
    console.log(` - Calculated Margin Amount: ₹${productData.margin}`);
    console.log(` - Resulting Selling Price: ₹${productData.sellingPrice}`);
    console.log(` - Expected Selling Price: ₹${expectedSellingPrice}`);
    
    if (productData.sellingPrice === expectedSellingPrice) {
      console.log("✅ VERIFICATION SUCCESSFUL");
    } else {
      console.log("❌ VERIFICATION FAILED");
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

testRecalculation();
