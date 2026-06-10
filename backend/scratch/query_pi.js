import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://gopikap2812_db_user:3EprufLKuDVKIdo3@branchesdb.njfcfju.mongodb.net/pearls_erp?retryWrites=true&w=majority";

const PurchaseInvoiceSchema = new mongoose.Schema({
  purchaseInvoiceId: String,
  invoiceDate: Date,
  createdAt: Date
}, { collection: 'purchaseinvoices' });

const PurchaseInvoice = mongoose.model('PurchaseInvoice', PurchaseInvoiceSchema);

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB!");
  
  const pi = await PurchaseInvoice.findOne({ purchaseInvoiceId: "PI/045/26-27" }).lean();
  console.log("PI FOUND:", JSON.stringify(pi, null, 2));
  
  await mongoose.disconnect();
}

main().catch(console.error);
