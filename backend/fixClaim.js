const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://gopikap2812_db_user:3EprufLKuDVKIdo3@branchesdb.njfcfju.mongodb.net/pearls_erp?retryWrites=true&w=majority').then(async () => { 
  const SalesOrder = mongoose.model('SalesOrder', new mongoose.Schema({}, {strict: false}), 'salesorders'); 
  const result = await SalesOrder.updateOne({ invoiceId: 'LSSO/1028/26-27' }, { "$set": { isClaim: false } }); 
  console.log('Fixed:', result); 
  process.exit(0); 
});
