import mongoose from 'mongoose';

const MONGO_URI = "mongodb+srv://gopikap2812_db_user:3EprufLKuDVKIdo3@branchesdb.njfcfju.mongodb.net/pearls_erp?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI).then(async () => {
  console.log("Connected to MongoDB database.");
  
  const auditlogs = mongoose.connection.collection('auditlogs');
  
  // Search for any logs containing the text "PEARLS ERP"
  const logsText = await auditlogs.find({ 
    $or: [
      { description: { $regex: 'PEARLS ERP', $options: 'i' } },
      { 'changes.before.name': { $regex: 'PEARLS ERP', $options: 'i' } },
      { 'changes.after.name': { $regex: 'PEARLS ERP', $options: 'i' } }
    ]
  }).toArray();
  
  console.log(`Found ${logsText.length} audit logs mentioning 'PEARLS ERP':`);
  logsText.forEach(l => {
    console.log(`- Date: ${l.createdAt}, Action: ${l.action}, Username: ${l.username}, Desc: ${l.description}`);
    if (l.changes) console.log("  Changes:", JSON.stringify(l.changes));
  });

  // Let's also look for any audit log around May 25, 2026 between 10:00 AM and 10:30 AM UTC
  const startTime = new Date("2026-05-25T10:00:00.000Z");
  const endTime = new Date("2026-05-25T10:30:00.000Z");
  const timeLogs = await auditlogs.find({
    createdAt: { $gte: startTime, $lte: endTime }
  }).toArray();
  
  console.log(`\nFound ${timeLogs.length} audit logs between 10:00 and 10:30 UTC on May 25, 2026:`);
  timeLogs.forEach(l => {
    console.log(`- Date: ${l.createdAt}, Action: ${l.action}, Username: ${l.username}, Desc: ${l.description}`);
    if (l.changes) console.log("  Changes:", JSON.stringify(l.changes));
  });

  process.exit(0);
}).catch(err => {
  console.error("Connection error:", err);
  process.exit(1);
});
