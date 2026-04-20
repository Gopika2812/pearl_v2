import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function checkAudit() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const AuditLog = mongoose.connection.db.collection('auditlogs');
    
    console.log("Checking recent audit logs for bulk upload or product updates...");
    const logs = await AuditLog.find({ 
      action: { $in: ["BULK_UPLOAD", "UPDATE_PRODUCT", "UPDATE_PRODUCT_PRICE", "UPLOAD_STOCK"] } 
    }).sort({ createdAt: -1 }).limit(20).toArray();
    
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
