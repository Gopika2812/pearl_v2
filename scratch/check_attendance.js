import mongoose from 'mongoose';
import Attendance from './backend/modules/hr-payroll/models/Attendance.js';

const mongoURI = 'mongodb://localhost:27017/pearl_erp_v2';

async function check() {
  await mongoose.connect(mongoURI);
  const logs = await Attendance.find({ 
    date: { 
      $gte: new Date('2026-05-01T00:00:00Z'),
      $lt: new Date('2026-05-02T00:00:00Z')
    } 
  }).populate('employeeId', 'name');
  
  console.log('Attendance Logs for Today:');
  logs.forEach(l => {
    console.log(`Emp: ${l.employeeId?.name}, Status: ${l.status}, Date: ${l.date.toISOString()}, In: ${l.presentTime}, Out: ${l.leaveTime}`);
  });
  process.exit();
}

check();
