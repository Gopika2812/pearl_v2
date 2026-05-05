import mongoose from 'mongoose';
import Branch from '../models/Branch.js';
import BranchUser from '../models/BranchUser.js';
import Attendance from '../modules/hr-payroll/models/Attendance.js';
import '../config/env.js';

async function findTestUsers() {
  await mongoose.connect(process.env.MONGO_URI);
  
  // Find TEST/GOPIKA in BranchUser
  const users = await BranchUser.find({ name: /test|gopika/i }).populate('branch','name').select('name branch branchName role');
  console.log("BranchUser results:", JSON.stringify(users, null, 2));
  
  // Also look in attendance records for these names
  const logs = await Attendance.find({})
    .populate({ path: 'employeeId', select: 'name role branch branchName', populate: { path: 'branch', select: 'name' } })
    .populate('branch', 'name')
    .sort({ createdAt: -1 })
    .limit(10);
  
  console.log("\nLatest attendance logs:");
  logs.forEach(l => console.log({
    id: l._id.toString(),
    employee: l.employeeId?.name || 'MISSING',
    employeeId: l.employeeId?._id?.toString() || l.employeeId?.toString(),
    attendanceBranch: l.branch?.name || 'NO BRANCH ON LOG',
    employeeBranch: l.employeeId?.branch?.name || 'NO EMP BRANCH',
    branchName: l.employeeId?.branchName || 'NO BRANCHNAME'
  }));
  
  process.exit(0);
}

findTestUsers().catch(e => { console.error(e); process.exit(1); });
