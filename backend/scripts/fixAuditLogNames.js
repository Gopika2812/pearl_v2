import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 🔌 Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🗃️ Database Connection
const MONGO_URI = 'mongodb+srv://gopikap2812_db_user:2AbCEcjSxgvum1zW@pearl.ujaby1i.mongodb.net/pearls_erp?retryWrites=true&w=majority';

// 📋 Define Models (Minimal Schemas for migration)
const auditLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, refPath: 'userModel' },
  userModel: { type: String, enum: ['BranchUser', 'SuperAdmin'] },
  username: { type: String },
  action: { type: String },
  description: { type: String },
}, { timestamps: true });

const branchUserSchema = new mongoose.Schema({
  username: { type: String },
  name: { type: String },
});

const superAdminSchema = new mongoose.Schema({
  username: { type: String },
  name: { type: String },
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
const BranchUser = mongoose.model('BranchUser', branchUserSchema);
const SuperAdmin = mongoose.model('SuperAdmin', superAdminSchema);

async function runMigration() {
  try {
    console.log('🚀 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected successfully!');

    // 🔍 Find logs with ID as username
    // ObjectId regex: 24 hex characters
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    
    const logsToFix = await AuditLog.find({
      username: { $regex: objectIdRegex }
    });

    console.log(`🔍 Found ${logsToFix.length} Audit Logs with Object IDs as usernames.`);

    if (logsToFix.length === 0) {
      console.log('✅ No logs to fix. Migration complete!');
      process.exit(0);
    }

    let updatedCount = 0;
    let failedCount = 0;

    for (const log of logsToFix) {
      const userId = log.username; // The username field currently holds the ID
      const modelName = log.userModel || 'BranchUser';
      
      let userDoc = null;
      
      try {
        if (modelName === 'BranchUser') {
          userDoc = await BranchUser.findById(userId);
        } else if (modelName === 'SuperAdmin') {
          userDoc = await SuperAdmin.findById(userId);
        }

        if (userDoc) {
          const actualName = userDoc.username || userDoc.name || 'System';
          
          log.username = actualName;
          await log.save();
          
          updatedCount++;
          console.log(`✨ Updated log ${log._id}: ${userId} -> ${actualName} (${log.action})`);
        } else {
          // If not found in the primary model, try the other one as a final fallback
          const otherModel = modelName === 'BranchUser' ? SuperAdmin : BranchUser;
          userDoc = await otherModel.findById(userId);
          
          if (userDoc) {
            const actualName = userDoc.username || userDoc.name || 'System';
            log.username = actualName;
            await log.save();
            updatedCount++;
            console.log(`✨ Updated log ${log._id} (cross-model): ${userId} -> ${actualName} (${log.action})`);
          } else {
            console.warn(`⚠️ Could not find user with ID ${userId} for log ${log._id}`);
            failedCount++;
          }
        }
      } catch (err) {
        console.error(`❌ Error updating log ${log._id}:`, err.message);
        failedCount++;
      }
    }

    console.log('--- Migration Summary ---');
    console.log(`✅ Successfully updated: ${updatedCount}`);
    console.log(`⚠️ Failed or not found: ${failedCount}`);
    console.log('-------------------------');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
