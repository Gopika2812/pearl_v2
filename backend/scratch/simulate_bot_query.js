import mongoose from 'mongoose';
import '../models/BranchUser.js';
import '../modules/hr-payroll/models/Attendance.js';
import '../models/Branch.js';

const BranchUser = mongoose.model('BranchUser');
const Attendance = mongoose.model('Attendance');
const Branch = mongoose.model('Branch');

async function test() {
  await mongoose.connect('mongodb+srv://gopikap2812_db_user:3EprufLKuDVKIdo3@branchesdb.njfcfju.mongodb.net/pearls_erp?retryWrites=true&w=majority');
  
  const bId = '69b6ae11c344418b6e011ce1'; // The wrong ID
  const isSuperAdmin = true;
  
  let bQuery = {};
  if (bId && mongoose.isValidObjectId(bId)) {
    const branchExists = await Branch.exists({ _id: bId });
    if (branchExists) {
        bQuery = { $or: [{ branch: new mongoose.Types.ObjectId(bId) }, { branchId: new mongoose.Types.ObjectId(bId) }] };
    } else if (isSuperAdmin) {
        bQuery = {};
    }
  }
  
  console.log('bQuery:', JSON.stringify(bQuery));
  
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setUTCHours(23, 59, 59, 999);
  
  const presentCount = await Attendance.countDocuments({ 
    ...bQuery, 
    date: { $gte: todayStart, $lte: todayEnd }, 
    status: { $regex: /^present/i } 
  });
  
  const totalStaff = await BranchUser.countDocuments({ 
    ...bQuery, 
    status: { $regex: /^active/i } 
  });
  
  console.log('Results:', { presentCount, totalStaff });
  
  // Also check without bQuery
  const globalPresent = await Attendance.countDocuments({ date: { $gte: todayStart, $lte: todayEnd }, status: { $regex: /^present/i } });
  const globalStaff = await BranchUser.countDocuments({ status: { $regex: /^active/i } });
  console.log('Global:', { globalPresent, globalStaff });
  
  process.exit(0);
}

test().catch(console.error);
