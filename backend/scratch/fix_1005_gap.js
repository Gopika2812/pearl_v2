import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Invoice = mongoose.connection.db.collection('invoices');
  const SalesOrder = mongoose.connection.db.collection('salesorders');
  const VoucherType = mongoose.connection.db.collection('vouchertypes');

  console.log('--- BEFORE UPDATE ---');
  const oldInvoice = await Invoice.findOne({ invoiceNumber: 'Z-1SI/1008/26-27' });
  console.log('Invoice in DB:', oldInvoice ? { _id: oldInvoice._id, invoiceNumber: oldInvoice.invoiceNumber } : 'NOT FOUND');

  const oldSO = await SalesOrder.findOne({ invoiceId: 'Z-1SO/1005/26-27' });
  console.log('SalesOrder in DB:', oldSO ? { _id: oldSO._id, invoiceId: oldSO.invoiceId, salesInvoiceId: oldSO.salesInvoiceId } : 'NOT FOUND');

  const voucher = await VoucherType.findOne({ prefix: 'Z-1SI' });
  console.log('VoucherType in DB:', voucher ? { _id: voucher._id, prefix: voucher.prefix, counter: voucher.counter } : 'NOT FOUND');

  if (oldInvoice && oldSO) {
    console.log('\n--- PERFORMING UPDATE ---');
    
    // 1. Update Invoice Number
    const invRes = await Invoice.updateOne(
      { _id: oldInvoice._id },
      { $set: { invoiceNumber: 'Z-1SI/1005/26-27' } }
    );
    console.log('Invoice update result:', invRes);

    // 2. Update SalesOrder Reference
    const soRes = await SalesOrder.updateOne(
      { _id: oldSO._id },
      { $set: { salesInvoiceId: 'Z-1SI/1005/26-27' } }
    );
    console.log('SalesOrder update result:', soRes);

    // 3. Update Voucher Counter (Set it to 1006)
    if (voucher) {
      const vRes = await VoucherType.updateOne(
        { _id: voucher._id },
        { $set: { counter: 1006 } }
      );
      console.log('VoucherType update result:', vRes);
    }
  } else {
    console.log('\n--- SKIPPING: COULD NOT FIND BOTH INVOICE AND SALES ORDER ---');
  }

  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
