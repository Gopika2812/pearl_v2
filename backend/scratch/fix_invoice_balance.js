import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Invoice from '../models/Invoice.js';

dotenv.config({ path: '../.env' });

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const invoice = await Invoice.findOne({ invoiceNumber: 'Z-1SI/1300/26-27' });
    if (invoice) {
        console.log(`Before Update - Invoice ${invoice.invoiceNumber}`);
        console.log('Opening Balance:', invoice.openingBalance);
        console.log('Closing Balance:', invoice.closingBalance);
        
        invoice.openingBalance = 18028;
        invoice.closingBalance = 33030;
        await invoice.save();
        
        console.log('\nAfter Update');
        console.log('Opening Balance:', invoice.openingBalance);
        console.log('Closing Balance:', invoice.closingBalance);
        console.log('Invoice updated successfully.');
    } else {
        console.log('Invoice not found');
    }
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
