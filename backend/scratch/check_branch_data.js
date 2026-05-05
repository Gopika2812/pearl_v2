import mongoose from 'mongoose';
import Branch from '../models/Branch.js';
import BranchUser from '../models/BranchUser.js';
import Attendance from '../modules/hr-payroll/models/Attendance.js';
import '../config/env.js';

async function checkData() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected\n");

  // Check BranchUsers with their branches
  const users = await BranchUser.find({}).populate('branch', 'name').select('name branch branchName role').limit(10);
  console.log("=== BranchUsers ===");
  users.forEach(u => console.log({
    name: u.name,
    role: u.role,
    branchName: u.branchName,
    branchObjName: u.branch?.name,
    branchObjId: u.branch?._id?.toString()
  }));

  // Check sample attendance records
  console.log("\n=== Sample Attendance ===");
  const logs = await Attendance.find({})
    .populate({ path: 'employeeId', select: 'name role branch branchName', populate: { path: 'branch', select: 'name' } })
    .populate('branch', 'name')
    .limit(5);
  logs.forEach(l => console.log({
    employee: l.employeeId?.name,
    attendanceBranch: l.branch?.name,
    employeeBranch: l.employeeId?.branch?.name,
    employeeBranchName: l.employeeId?.branchName
  }));

  process.exit(0);
}

checkData().catch(e => { console.error(e); process.exit(1); });
