import mongoose from 'mongoose';
import '../modules/hr-payroll/models/Attendance.js';

const Attendance = mongoose.model('Attendance');

async function check() {
  await mongoose.connect('mongodb+srv://gopikap2812_db_user:3EprufLKuDVKIdo3@branchesdb.njfcfju.mongodb.net/pearls_erp?retryWrites=true&w=majority');
  
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const attendance = await Attendance.findOne({ employeeId: '69cbbfc7ed9ad43085a1629f', date: { $gte: today } });
  if (attendance) {
    console.log('Attendance found for SATHYA');
    console.log('Status:', attendance.status);
    console.log('Branch ID in Attendance:', attendance.branch?.toString());
  } else {
    console.log('No attendance record found for SATHYA today');
  }
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
