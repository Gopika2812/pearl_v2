import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const AuditLogSchema = new mongoose.Schema({}, { strict: false });
const AuditLog = mongoose.model('AuditLog', AuditLogSchema);

async function checkLogs() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(10);
    console.log(JSON.stringify(logs, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkLogs();
