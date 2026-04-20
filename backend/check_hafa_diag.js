import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function checkHafa() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const Product = mongoose.connection.db.collection('products');
    const Branch = mongoose.connection.db.collection('branches');
    
    const hafa = await Branch.findOne({ name: /HAFA/i });
    if (!hafa) {
      console.log("❌ HAFA FROZEN FOODS branch not found.");
      const allBranches = await Branch.find({}).toArray();
      console.log("Available branches:", allBranches.map(b => b.name));
      process.exit(1);
    }
    
    console.log(`✅ Found Branch: ${hafa.name} (${hafa._id})`);
    
    const total = await Product.countDocuments({ branchId: hafa._id });
    const withOpening = await Product.countDocuments({ branchId: hafa._id, openingQty: { $gt: 0 } });
    
    console.log(`Total Products in HAFA: ${total}`);
    console.log(`Products with openingQty > 0: ${withOpening}`);
    
    const sample = await Product.find({ branchId: hafa._id, name: /AH CHEESE CORN MOMOS/i }).toArray();
    sample.forEach(p => {
       console.log(`Product: ${p.name}`);
       console.log(` - openingQty: ${p.openingQty}`);
       console.log(` - totalQty: ${p.totalQty}`);
       console.log(` - manualOpeningDate: ${p.manualOpeningDate}`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkHafa();
