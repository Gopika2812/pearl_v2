import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function checkSpecifics() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;
    
    const items = ["AH Corn Samosa (1*20)", "AH CHEESE CORN MOMOS 500GM", "AH Veg Patties (1*10)"];
    
    for (const name of items) {
      console.log(`\n🔍 Searching for: ${name}`);
      const products = await db.collection('products').find({ name: { $regex: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } }).toArray();
      
      for (const p of products) {
        const branch = await db.collection('branches').findOne({ _id: p.branchId });
        console.log(`Branch: ${branch?.name} (${p.branchId})`);
        console.log(` - openingQty: ${p.openingQty}`);
        console.log(` - totalQty: ${p.totalQty}`);
        console.log(` - manualOpeningDate: ${p.manualOpeningDate}`);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkSpecifics();
