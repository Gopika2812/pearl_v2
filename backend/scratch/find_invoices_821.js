import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Invoice = mongoose.connection.db.collection('invoices');
  const SalesOrder = mongoose.connection.db.collection('salesorders');

  const so821 = await SalesOrder.findOne({ invoiceId: 'GEKPSO/821/26-27' });
  console.log('SO 821:', {
    _id: so821._id,
    salesInvoiceId: so821.salesInvoiceId,
    status: so821.status
  });

  const invoices = await Invoice.find({ salesOrderId: so821._id }).toArray();
  console.log('Invoices linked to SO 821:');
  invoices.forEach(inv => {
    console.log({
      _id: inv._id,
      invoiceNumber: inv.invoiceNumber,
      status: inv.status,
      createdAt: inv.createdAt,
      updatedAt: inv.updatedAt,
      grandTotal: inv.grandTotal
    });
  });

  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
