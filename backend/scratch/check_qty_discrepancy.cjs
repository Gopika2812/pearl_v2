const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const AuditLog = require('../models/AuditLog.js').default;

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const start = new Date('2026-05-14T00:00:00Z');
  const end = new Date('2026-05-15T00:00:00Z');
  
  const logs = await AuditLog.find({ 
    createdAt: { $gte: start, $lte: end },
    description: { $regex: /bulk|upload|excel|import|sync/i }
  }).sort({ createdAt: 1 });

  console.log(`Matching logs from yesterday:`);
  logs.forEach(l => {
    console.log(` - [${l.createdAt.toISOString()}] User: ${l.username}, Action: ${l.action}, Desc: ${l.description}`);
  });
  process.exit(0);
});
