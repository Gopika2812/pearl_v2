import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function checkStock() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const Product = mongoose.connection.db.collection('products');
    const Branch = mongoose.connection.db.collection('branches');
    
    const branches = await Branch.find({}).toArray();
    console.log(`Found ${branches.length} branches.`);

    for (const b of branches) {
      const total = await Product.countDocuments({ branchId: b._id });
      const withOpening = await Product.countDocuments({ branchId: b._id, openingQty: { $gt: 0 } });
      console.log(`Branch: ${b.name} (${b._id})`);
      console.log(` - Total Products: ${total}`);
      console.log(` - Products with openingQty > 0: ${withOpening}`);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkStock();
