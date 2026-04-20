import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function checkAudit() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const AuditLog = mongoose.connection.db.collection('auditlogs');
    
    const startOfMar31 = new Date("2026-03-30T18:30:00.000Z"); // Mar 31 00:00 IST
    const endOfMar31 = new Date("2026-03-31T18:29:59.999Z"); // Mar 31 23:59 IST

    console.log("Checking audit logs for March 31st...");
    const logs = await AuditLog.find({ 
      createdAt: { $gte: startOfMar31, $lte: endOfMar31 }
    }).sort({ createdAt: 1 }).toArray();
    
    console.log(`Found ${logs.length} logs on March 31st.`);
    logs.forEach(l => {
      console.log(`[${l.createdAt.toISOString()}] ${l.username}: ${l.action} - ${l.description}`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkAudit();
