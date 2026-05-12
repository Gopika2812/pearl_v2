import mongoose from 'mongoose';
import '../modules/hr-payroll/models/Attendance.js';

const Attendance = mongoose.model('Attendance');

async function check() {
  await mongoose.connect('mongodb+srv://gopikap2812_db_user:3EprufLKuDVKIdo3@branchesdb.njfcfju.mongodb.net/pearls_erp?retryWrites=true&w=majority');
  
  const records = await Attendance.find().sort({ createdAt: -1 }).limit(10);
  records.forEach(r => {
    console.log(`- Status: "${r.status}", Length: ${r.status?.length}, Type: ${typeof r.status}`);
  });
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
