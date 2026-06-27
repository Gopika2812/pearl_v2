import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';

dotenv.config({ path: '../.env' });

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const invoice = await Invoice.findOne({ invoiceNumber: 'Z-1SI/1300/26-27' });
    if (invoice) {
        console.log('Invoice Found:', invoice.invoiceNumber);
        console.log('Opening Balance on Invoice:', invoice.openingBalance);
        console.log('Closing Balance on Invoice:', invoice.closingBalance);
        
        const customer = await Customer.findById(invoice.customer.customerId);
        if (customer) {
            console.log('Customer:', customer.name);
            console.log('Debit:', customer.debit);
            console.log('Credit:', customer.credit);
            console.log('Balance:', customer.debit - customer.credit);
        }
    } else {
        console.log('Invoice not found');
    }
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
