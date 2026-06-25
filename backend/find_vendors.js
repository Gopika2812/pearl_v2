import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const db = mongoose.connection.db;
  
  const branches = await db.collection('branches').find({}).toArray();
  const goldenFoods = branches.find(b => b.name.toLowerCase().includes('golden foods'));
  
  if (!goldenFoods) {
      console.log("Could not find branch Golden Foods");
      process.exit(1);
  }

  const vendors = await db.collection('vendors').find({ 
      branchId: goldenFoods._id,
      name: { $in: ['Pearl Agency', 'PEARLAGENCY'] }
  }).toArray();
  
  console.log("Vendors found:");
  vendors.forEach(v => {
      console.log(`ID: ${v._id}, Name: "${v.name}", Debit: ${v.debit}, Credit: ${v.credit}, Linked: ${v.linkedBranchId}`);
  });
  
  process.exit(0);
}).catch(console.error);
