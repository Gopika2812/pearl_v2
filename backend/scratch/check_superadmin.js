import mongoose from 'mongoose';
import '../models/SuperAdmin.js';

const SuperAdmin = mongoose.model('SuperAdmin');

async function check() {
  await mongoose.connect('mongodb+srv://gopikap2812_db_user:3EprufLKuDVKIdo3@branchesdb.njfcfju.mongodb.net/pearls_erp?retryWrites=true&w=majority');
  
  const admin = await SuperAdmin.findOne({ username: 'superadmin' });
  if (admin) {
    console.log('SuperAdmin Data:', JSON.stringify(admin, null, 2));
  } else {
    console.log('Superadmin not found');
  }
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
