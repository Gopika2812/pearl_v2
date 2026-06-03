import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({path: '../.env'});
import SalesOrder from '../models/SalesOrder.js';

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const o = await SalesOrder.findOne({ invoiceId: { $regex: '1362' } });
  console.log("Order Date:", o.createdAt);
  process.exit();
}).catch(console.error);
