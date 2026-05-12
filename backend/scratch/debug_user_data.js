import mongoose from 'mongoose';
import '../models/BranchUser.js';

const BranchUser = mongoose.model('BranchUser');

async function check() {
  await mongoose.connect('mongodb+srv://gopikap2812_db_user:3EprufLKuDVKIdo3@branchesdb.njfcfju.mongodb.net/pearls_erp?retryWrites=true&w=majority');
  
  const user = await BranchUser.findOne({ name: /SATHYA/i });
  if (user) {
    console.log('User:', user.name);
    console.log('Branch:', user.branch?.toString());
    console.log('Status:', user.status);
    console.log('Full User:', JSON.stringify(user, null, 2));
  } else {
    console.log('User SATHYA not found');
  }
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
