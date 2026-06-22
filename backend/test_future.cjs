require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI).then(async () => {
  const SalesOrder = require('./models/SalesOrder.js').default;
  const docs = await SalesOrder.find({ invoiceId: 'Z-2SO/1378/26-27' });
  console.log(JSON.stringify(docs, null, 2));
  process.exit(0);
});
