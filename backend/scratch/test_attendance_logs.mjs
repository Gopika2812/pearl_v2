import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

await mongoose.connect(process.env.MONGO_URI);
console.log('✅ Connected to MongoDB');

// Import controller (triggers all model registrations via imports)
const mod = await import('../modules/hr-payroll/controllers/attendanceController.js');

// Get a real branchId from DB
const BranchUser = (await import('../models/BranchUser.js')).default;
const oneUser = await BranchUser.findOne().select('branch').lean();
console.log('Sample BranchUser:', oneUser);

const branchId = oneUser?.branch?.toString() || null;
console.log('Testing with branchId:', branchId);

const fakeReq = {
  query: {
    branchId,
    startDate: '2026-04-04',
    endDate: '2026-05-04'
  },
  user: { role: 'SUPER_ADMIN', id: 'abc123' }
};

let responseCode, responseData;
const fakeRes = {
  status: (code) => {
    responseCode = code;
    return { json: (data) => { responseData = data; } };
  }
};

await mod.getDetailedLogs(fakeReq, fakeRes);
console.log('STATUS:', responseCode);
if (!responseData?.success) {
  console.error('❌ ERROR:', responseData?.message);
} else {
  console.log(`✅ Got ${responseData.data?.length} records`);
  if (responseData.data?.[0]) {
    console.log('Sample record:', JSON.stringify(responseData.data[0], null, 2).slice(0, 800));
  }
}

await mongoose.disconnect();
