import mongoose from 'mongoose';
import '../models/Branch.js';

const Branch = mongoose.model('Branch');

async function check() {
  await mongoose.connect('mongodb+srv://gopikap2812_db_user:3EprufLKuDVKIdo3@branchesdb.njfcfju.mongodb.net/pearls_erp?retryWrites=true&w=majority');
  
  const allBranches = await Branch.find();
  console.log('All Branch IDs & Names:', allBranches.map(b => ({ id: b._id.toString(), name: b.name })));
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
