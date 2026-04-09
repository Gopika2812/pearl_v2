const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: './.env' });

const ProductSchema = new mongoose.Schema({
  name: String,
  branchId: mongoose.Schema.Types.ObjectId,
  totalQty: Number
}, { collection: 'products' });

const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

async function checkProducts() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected.');

    const namesToCheck = [
      "Z Rich Whip Topping (Gold) 1 Kg",
      "Bread Knife 13 Inch",
      "DRY ICE",
      "TRANSPORTATION CHARGE 1",
      "VLF LJS Chicken Patti Samosa (1*25)"
    ];

    for (const name of namesToCheck) {
      const products = await Product.find({ name: { $regex: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } });
      if (products.length === 0) {
        console.log(`❌ ${name}: NOT FOUND`);
      } else {
        products.forEach(p => {
          console.log(`✅ ${name}: Found as "${p.name}" in branch ${p.branchId} (Qty: ${p.totalQty || 0})`);
        });
      }
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

checkProducts();
