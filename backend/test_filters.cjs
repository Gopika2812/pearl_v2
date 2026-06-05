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
    const customers = await db.collection('customers').find(filter).limit(10).toArray();
    console.log('--- NONE MATCHES ---', customers.length);
    customers.forEach(c => console.log(c.name, '| groups:', c.customerGroups, '| group:', c.customerGroup));

    console.log('\n--- ALL CUSTOMERS SAMPLE ---');
    const all = await db.collection('customers').find({branchId}).limit(10).toArray();
    all.forEach(c => console.log(c.name, '| groups:', c.customerGroups, '| group:', c.customerGroup));

  } catch (err) {
    console.error('Error:', err.message);
  }
  process.exit(0);
});
