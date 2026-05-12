import mongoose from 'mongoose';
import '../modules/hr-payroll/models/Attendance.js';
import '../models/BranchUser.js';
import '../models/Branch.js';

const Attendance = mongoose.model('Attendance');
const BranchUser = mongoose.model('BranchUser');
const Branch = mongoose.model('Branch');

async function check() {
  await mongoose.connect('mongodb+srv://gopikap2812_db_user:3EprufLKuDVKIdo3@branchesdb.njfcfju.mongodb.net/pearls_erp?retryWrites=true&w=majority');
  
  const branch = await Branch.findOne({ name: /Pearl Agency/i });
  if (!branch) {
    console.log('Branch not found');
    return;
  }
  
  console.log('Branch ID:', branch._id.toString());
  
  const staffCount = await BranchUser.countDocuments({ branchId: branch._id });
  console.log('Total Staff in DB:', staffCount);
  
  const today = new Date();
  today.setHours(0,0,0,0);
  const attendance = await Attendance.find({ branchId: branch._id, date: { $gte: today } });
  console.log('Attendance records today:', attendance.length);
  if (attendance.length > 0) {
    console.log('Statuses found:', attendance.map(a => a.status));
  } else {
      console.log('No attendance for this branch today.');
      const any = await Attendance.findOne().sort({ createdAt: -1 });
      console.log('Latest attendance in DB:', any);
  }
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
