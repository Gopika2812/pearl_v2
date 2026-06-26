const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGO_URI).then(async () => {
  const products = await mongoose.connection.collection('products').find({ name: { $regex: 'Tomato', $options: 'i' } }).toArray();
  console.log(products.map(p => ({ id: p._id, name: p.name, branchId: p.branchId })));
  process.exit(0);
}).catch(console.error);
