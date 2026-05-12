import mongoose from 'mongoose';
import '../modules/hr-payroll/models/Attendance.js';

const Attendance = mongoose.model('Attendance');

async function check() {
  await mongoose.connect('mongodb+srv://gopikap2812_db_user:3EprufLKuDVKIdo3@branchesdb.njfcfju.mongodb.net/pearls_erp?retryWrites=true&w=majority');
  
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const records = await Attendance.find({ date: { $gte: today } });
  console.log('Records for today:', records.length);
  records.forEach(r => {
    console.log(`- Employee: ${r.employeeId}, Status: "${r.status}", Branch: ${r.branch}`);
  });
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
