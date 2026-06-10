import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const SalesOrder = mongoose.connection.db.collection('salesorders');
  
  const sos = await SalesOrder.find({
    invoiceId: { $regex: 'Z-2SO/(1067|1068|1069|1070|1071|1072)' }
  }).sort({ invoiceId: 1 }).toArray();

  console.log('--- Order Details ---');
  sos.forEach(so => {
    console.log({
      invoiceId: so.invoiceId,
      salesInvoiceId: so.salesInvoiceId,
      status: so.status,
      createdAt: so.createdAt,
      customerName: so.customerName
    });
  });

  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
