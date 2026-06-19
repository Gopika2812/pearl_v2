const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://gopikap2812_db_user:3EprufLKuDVKIdo3@branchesdb.njfcfju.mongodb.net/pearls_erp?retryWrites=true&w=majority')
  .then(async () => {
    try {
      const Invoice = mongoose.connection.db.collection('invoices');
      const SalesOrder = mongoose.connection.db.collection('salesorders');
      
      const r1 = await Invoice.updateOne(
        { invoiceNumber: 'Z-1SI/1206/26-27' }, 
        { $set: { openingBalance: 14080, closingBalance: 32108, balanceType: 'Dr' } }
      );
      console.log('Invoice updated:', r1.modifiedCount);
      
      const r2 = await SalesOrder.updateOne(
        { invoiceNumber: 'Z-1SI/1206/26-27' }, 
        { $set: { invoiceOpeningBalance: 14080, invoiceClosingBalance: 32108 } }
      );
      console.log('SalesOrder updated:', r2.modifiedCount);
      
      console.log('Fixed DB successfully!');
    } catch (e) {
      console.error(e);
    } finally {
      process.exit(0);
    }
  });
