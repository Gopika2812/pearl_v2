import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const AuditLog = mongoose.connection.db.collection('auditlogs');

  const logs = await AuditLog.find({
    description: { $regex: 'Z-2SO/(1067|1068|1069|1070|1071|1072)' }
  }).sort({ createdAt: 1 }).toArray();

  console.log('--- Audit Logs for Creation ---');
  logs.forEach(log => {
    console.log(`${log.createdAt.toISOString()} - ${log.username} - ${log.action} - ${log.description}`);
  });

  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
