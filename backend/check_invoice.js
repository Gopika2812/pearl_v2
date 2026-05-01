import mongoose from 'mongoose';
import Invoice from './models/Invoice.js';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/pearl_v2")
  .then(async () => {
    const inv = await Invoice.findOne({ invoiceNumber: "BSI/012/26-27" });
    if (inv) {
      console.log(JSON.stringify(inv, null, 2));
    } else {
      console.log("Not found");
    }
    process.exit(0);
  });
