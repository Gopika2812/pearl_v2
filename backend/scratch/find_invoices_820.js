import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Invoice = mongoose.connection.db.collection('invoices');
  const SalesOrder = mongoose.connection.db.collection('salesorders');

  const so820 = await SalesOrder.findOne({ invoiceId: 'GEKPSO/820/26-27' });
  console.log('SO 820:', {
    _id: so820._id,
    salesInvoiceId: so820.salesInvoiceId,
    status: so820.status
  });

  const invoices = await Invoice.find({ salesOrderId: so820._id }).toArray();
  console.log('Invoices linked to SO 820:');
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
