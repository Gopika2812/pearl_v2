const mongoose = require('mongoose');
require('dotenv').config();

const CustomerSchema = new mongoose.Schema({
  name: String,
  branchId: mongoose.Schema.Types.ObjectId,
  customerGroups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CustomerGroup' }],
  customerGroup: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerGroup' }
}, { strict: false });

const Customer = mongoose.model('Customer', CustomerSchema);

mongoose.connect(process.env.MONGO_URI).then(async () => {
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
  const pipeline = [{ $match: filter }];

  try {
    const agg = await Customer.aggregate(pipeline);
    console.log('--- NONE MATCHES (Mongoose AGG) ---', agg.length);
    if(agg.length > 0) {
      console.log('First:', agg[0].name, 'Groups:', agg[0].customerGroups);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
  process.exit(0);
});
