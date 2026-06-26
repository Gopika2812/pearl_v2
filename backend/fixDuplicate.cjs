const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Product = mongoose.model('Product', new mongoose.Schema({}, {strict: false}), 'products');
  
  // The auto-created duplicate
  const dup = await Product.findOne({ name: 'DM TOMATO KETCHUP 8 GM NEW (1*14) ', branchId: new mongoose.Types.ObjectId('69cbade8bc6c37f37b325526') });
  if (dup) {
    console.log('Found duplicate:', dup._id);
    await Product.deleteOne({ _id: dup._id });
    console.log('Deleted duplicate.');
  }

  // The original that should be renamed
  const orig = await Product.findOne({ _id: new mongoose.Types.ObjectId('69cdbc44e079e44bfe367112') });
  if (orig) {
    console.log('Found original:', orig.name);
    await Product.updateOne({ _id: orig._id }, { $set: { name: 'DM TOMATO KETCHUP 8 GM NEW (1*14) ' } });
    console.log('Renamed original.');
  }

  process.exit(0);
}).catch(console.error);
