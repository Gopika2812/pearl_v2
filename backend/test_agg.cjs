const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGO_URI).then(async () => {
  const db = mongoose.connection.db;
  const branchId = new mongoose.Types.ObjectId('69cb755611501727ed6ec9cb');
  const andConditions = [{ branchId }];
  
  andConditions.push({
    $or: [
      { customerGroups: { $size: 0 } },
      { customerGroups: { $exists: false } },
      { customerGroups: null },
      { customerGroup: null },
      { customerGroup: { $exists: false } }
    ]
  });

  const filter = { $and: andConditions };
  try {
    const agg = await db.collection('customers').aggregate([{ $match: filter }]).toArray();
    console.log('--- NONE MATCHES (AGG) ---', agg.length);
  } catch (err) {
    console.error('Error:', err.message);
  }
  process.exit(0);
});
