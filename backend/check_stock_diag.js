import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function checkStock() {
  try {
    console.log("Connecting to:", process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI);
    const Product = mongoose.connection.db.collection('products');
    
    console.log("Checking products...");
    const products = await Product.find({}).limit(5).toArray();
    
    products.forEach(p => {
      console.log(`Product: ${p.name}`);
      console.log(` - totalQty: ${p.totalQty}`);
      console.log(` - openingQty: ${p.openingQty}`);
      console.log(` - manualOpeningDate: ${p.manualOpeningDate}`);
      console.log('---');
    });
    
    const totalCount = await Product.countDocuments({});
    const countWithOpening = await Product.countDocuments({ openingQty: { $gt: 0 } });
    
    console.log(`Total Products: ${totalCount}`);
    console.log(`Products with openingQty > 0: ${countWithOpening}`);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkStock();
