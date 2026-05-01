import mongoose from 'mongoose';
import Invoice from './models/Invoice.js';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/pearl_v2")
  .then(async () => {
    const inv = await Invoice.findOne({ invoiceNumber: { $regex: "CSSI/001/" } });
    console.log(inv ? `Found: ${inv.invoiceNumber} - Status: ${inv.status} - Type: ${inv.invoiceType}` : "Not found");
    
    process.exit(0);
  });
