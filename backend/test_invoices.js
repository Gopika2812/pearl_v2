import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

const checkInvoices = async () => {
  await connectDB();
  
  const Invoice = mongoose.model('Invoice', new mongoose.Schema({}, {strict: false}), 'invoices');
  
  const inv1 = await Invoice.findOne({ invoiceNumber: 'LESI/700/26-27' });
  const inv2 = await Invoice.findOne({ invoiceNumber: 'LESI/707/26-27' });
  
  console.log("LESI/700/26-27 => status:", inv1?.status, "customerId:", inv1?.customer?.customerId, "grandTotal:", inv1?.grandTotal, "invoiceDate:", inv1?.invoiceDate, "createdAt:", inv1?.createdAt);
  console.log("LESI/707/26-27 => status:", inv2?.status, "customerId:", inv2?.customer?.customerId, "grandTotal:", inv2?.grandTotal, "invoiceDate:", inv2?.invoiceDate, "createdAt:", inv2?.createdAt);
  
  process.exit(0);
};

checkInvoices();
