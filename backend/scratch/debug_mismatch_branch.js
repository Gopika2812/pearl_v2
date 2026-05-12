import mongoose from 'mongoose';
import '../models/Branch.js';

const Branch = mongoose.model('Branch');

async function check() {
  await mongoose.connect('mongodb+srv://gopikap2812_db_user:3EprufLKuDVKIdo3@branchesdb.njfcfju.mongodb.net/pearls_erp?retryWrites=true&w=majority');
  
  const b = await Branch.findById('69b6ae11c344418b6e011ce1');
  if (b) {
    console.log('Branch ID 69b6... belongs to:', b.name);
  } else {
    console.log('Branch ID 69b6... not found');
  }
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
