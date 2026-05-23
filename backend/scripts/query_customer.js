import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from backend folder
dotenv.config({ path: path.join(__dirname, "../.env") });

const MONGO_URI = process.env.MONGO_URI;

// Define simple schemas inline to avoid any import side effects
const customerSchema = new mongoose.Schema({}, { strict: false });
const Customer = mongoose.model("Customer", customerSchema);

const invoiceSchema = new mongoose.Schema({}, { strict: false });
const Invoice = mongoose.model("Invoice", invoiceSchema);

const receiptSchema = new mongoose.Schema({}, { strict: false });
const Receipt = mongoose.model("Receipt", receiptSchema);

async function run() {
  console.log("Connecting...");
  await mongoose.connect(MONGO_URI);
  console.log("Connected!");

  const customer = await Customer.findOne({ name: /Subash/i });
  console.log("Customer found:", JSON.stringify(customer, null, 2));

  if (customer) {
    const cIdStr = customer._id.toString();
    const invoices = await Invoice.find({
      "customer.customerId": customer._id
    }).lean();
    console.log(`Invoices found by ObjectId (${invoices.length}):`, invoices.map(i => ({ number: i.invoiceNumber, total: i.grandTotal, status: i.status })));

    const invoicesStr = await Invoice.find({
      "customer.customerId": cIdStr
    }).lean();
    console.log(`Invoices found by String (${invoicesStr.length}):`, invoicesStr.map(i => ({ number: i.invoiceNumber, total: i.grandTotal, status: i.status })));

    const receipts = await Receipt.find({
      "customer.customerId": customer._id
    }).lean();
    console.log(`Receipts found by ObjectId (${receipts.length}):`, receipts.map(r => ({ id: r.receiptId, amount: r.amount, status: r.status })));

    const receiptsStr = await Receipt.find({
      "customer.customerId": cIdStr
    }).lean();
    console.log(`Receipts found by String (${receiptsStr.length}):`, receiptsStr.map(r => ({ id: r.receiptId, amount: r.amount, status: r.status })));
  }

  await mongoose.disconnect();
  console.log("Disconnected!");
}

run().catch(console.error);
