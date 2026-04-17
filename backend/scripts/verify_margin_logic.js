import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Product from '../models/Product.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function runTest() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const testProductName = `Test Product ${Date.now()}`;
  const branchId = new mongoose.Types.ObjectId();

  // 1. Create a product with specific margin
  console.log('\n--- Step 1: Create Initial Product ---');
  let product = new Product({
    name: testProductName,
    branchId,
    purchasingPrice: 100,
    sellingPrice: 120, // ₹20 margin
    units: 'Pcs',
    perQty: 1,
    hsnCode: '1234'
  });
  await product.save();
  console.log(`Created: P: ₹${product.purchasingPrice}, S: ₹${product.sellingPrice}, Margin: ₹${product.margin}`);

  // 2. Update ONLY purchasingPrice via save()
  console.log('\n--- Step 2: Update Purchasing Price via save() ---');
  product.purchasingPrice = 150;
  await product.save();
  console.log(`Updated (save): P: ₹${product.purchasingPrice}, S: ₹${product.sellingPrice}, Margin: ₹${product.margin}`);
  
  if (product.sellingPrice === 170) {
    console.log('✅ PASS: Selling price updated to maintain margin.');
  } else {
    console.log('❌ FAIL: Selling price did not update correctly.');
  }

  // 3. Update ONLY purchasingPrice via findByIdAndUpdate
  console.log('\n--- Step 3: Update Purchasing Price via findByIdAndUpdate ---');
  await Product.findByIdAndUpdate(product._id, { purchasingPrice: 200 });
  product = await Product.findById(product._id);
  console.log(`Updated (findByIdAndUpdate): P: ₹${product.purchasingPrice}, S: ₹${product.sellingPrice}, Margin: ₹${product.margin}`);

  if (product.sellingPrice === 220) {
    console.log('✅ PASS: Selling price updated to maintain margin.');
  } else {
    console.log('❌ FAIL: Selling price did not update correctly.');
  }

  // 4. Cleanup
  await Product.deleteOne({ _id: product._id });
  await mongoose.disconnect();
  console.log('\nTest completed.');
}

runTest().catch(console.error);
