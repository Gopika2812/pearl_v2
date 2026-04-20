import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function findHafaExact() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;
    
    // Find EVERY branch to be sure
    const branches = await db.collection('branches').find({}).toArray();
    console.log("Branches in system:");
    branches.forEach(b => console.log(` - "${b.name}" | ID: ${b._id}`));
    
    const target = branches.find(b => b.name.includes("Pearl Agency foods & frozen") || b.name.includes("HAFA"));
    if (target) {
      console.log(`\nTargeting Branch: ${target.name} (${target._id})`);
      const products = await db.collection('products').find({ branchId: target._id }).toArray();
      console.log(`Total products in this branch: ${products.length}`);
      
      const sample = products.filter(p => p.name.includes("CHEESE CORN MOMOS"));
      sample.forEach(p => {
        console.log(`Product: ${p.name} | Opening: ${p.openingQty} | Total: ${p.totalQty}`);
      });
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

findHafaExact();
