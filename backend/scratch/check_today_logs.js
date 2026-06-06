import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const AuditLog = mongoose.connection.db.collection('auditlogs');

  const logs = await AuditLog.find({
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  }).toArray();

  console.log('--- ALL LOGS FOR TODAY ---');
  logs.forEach(l => {
    if (JSON.stringify(l).includes('822') || JSON.stringify(l).includes('821') || JSON.stringify(l).includes('823')) {
      console.log(`${l.createdAt.toISOString()} - ${l.username} - ${l.action} - ${l.description}`);
    }
  });

  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
