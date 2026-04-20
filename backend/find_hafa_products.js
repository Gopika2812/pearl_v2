import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function findHafa() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;
    const branches = await db.collection('branches').find({}).toArray();
    
    console.log("All Branches in DB:");
    branches.forEach(b => {
      console.log(` - ${b.name} (ID: ${b._id})`);
    });

    const products = await db.collection('products').find({ name: /AH CHEESE CORN MOMOS/i }).toArray();
    console.log(`Found ${products.length} products matching 'AH CHEESE CORN MOMOS'`);
    products.forEach(p => {
      console.log(`Product: ${p.name} | BranchID: ${p.branchId} | Opening: ${p.openingQty} | Total: ${p.totalQty}`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

findHafa();
