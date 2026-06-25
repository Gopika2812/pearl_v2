import mongoose from 'mongoose';

mongoose.connect('mongodb://127.0.0.1:27017/pearls-erp').then(async () => {
  const db = mongoose.connection.db;
  const vendors = await db.collection('vendors').find({}).toArray();
  const branches = await db.collection('branches').find({}).toArray();
  
  console.log('--- Branches ---');
  branches.forEach(b => console.log(b._id, b.name));

  console.log('\n--- Pearl Vendors ---');
  vendors.filter(v => v.name.toLowerCase().includes('pearl')).forEach(v => console.log(v._id, 'Branch:', v.branchId, 'Name:', v.name, 'Linked:', v.linkedBranchId));
  process.exit(0);
}).catch(console.error);
