import mongoose from 'mongoose';
import '../models/Branch.js';

const Branch = mongoose.model('Branch');

async function check() {
  await mongoose.connect('mongodb+srv://gopikap2812_db_user:3EprufLKuDVKIdo3@branchesdb.njfcfju.mongodb.net/pearls_erp?retryWrites=true&w=majority');
  
  const branches = await Branch.find({ name: /Pearl Agency/i });
  console.log('Branches found:', branches.map(b => ({ name: b.name, id: b._id.toString() })));
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
