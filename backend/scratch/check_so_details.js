import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const SalesOrder = mongoose.connection.db.collection('salesorders');
  
  const sos = await SalesOrder.find({
    invoiceId: { $in: ['GESO/1164/26-27', 'GESO/1165/26-27', 'GESO/1166/26-27', 'GESO/1167/26-27'] }
  }).toArray();
  
  console.log('--- Matching Sales Orders ---');
  sos.forEach(so => {
    console.log({
      _id: so._id,
      invoiceId: so.invoiceId,
      salesInvoiceId: so.salesInvoiceId,
      invoiceGenerated: so.invoiceGenerated,
      status: so.status,
      orderDate: so.orderDate,
      createdAt: so.createdAt,
      branchId: so.branchId
    });
  });
  
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
