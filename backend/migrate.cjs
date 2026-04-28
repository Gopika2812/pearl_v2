const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://gopikap2812_db_user:3EprufLKuDVKIdo3@branchesdb.njfcfju.mongodb.net/pearls_erp?retryWrites=true&w=majority').then(async () => {
  const CreditNote = mongoose.model('CreditNote', new mongoose.Schema({ originalSalesOrderId: mongoose.Schema.Types.ObjectId, originalInvoiceId: String, originalInvoiceDate: Date }, {strict: false}), 'creditnotes');
  const Invoice = mongoose.model('Invoice', new mongoose.Schema({ salesOrderId: mongoose.Schema.Types.ObjectId, invoiceNumber: String, invoiceDate: Date }, {strict: false}), 'invoices');
  const notes = await CreditNote.find({ originalSalesOrderId: { $ne: null } });
  let updated = 0;
  for (let cn of notes) {
    const inv = await Invoice.findOne({ salesOrderId: cn.originalSalesOrderId });
    if (inv && inv.invoiceNumber && cn.originalInvoiceId !== inv.invoiceNumber) {
      await CreditNote.updateOne(
        { _id: cn._id },
        { $set: { originalInvoiceId: inv.invoiceNumber, originalInvoiceDate: inv.invoiceDate || cn.originalInvoiceDate } }
      );
      updated++;
    }
  }
  console.log('Updated ' + updated + ' Credit Notes to show Invoice Number instead of Sales Order Number.');
  process.exit(0);
});
