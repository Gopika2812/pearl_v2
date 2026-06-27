import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Customer from '../models/Customer.js';

dotenv.config({ path: '../.env' });

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const customer = await Customer.findOne({ name: 'ALAGUTHAMBIRAN.M' });
    if (customer) {
        console.log('Customer:', customer.name);
        console.log('Debit:', customer.debit);
        console.log('Credit:', customer.credit);
        console.log('Balance:', customer.debit - customer.credit);
    } else {
        console.log('Customer not found');
    }
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
