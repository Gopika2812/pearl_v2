import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });
const MONGO_URI = process.env.MONGO_URI;

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB.");

  const Customer = mongoose.model("Customer", new mongoose.Schema({}, { strict: false }));
  
  const customer = await Customer.findOne({ name: /Buhari/i });
  if (!customer) {
    console.log("Buhari Restaurant not found.");
    process.exit(1);
  }

  console.log("Current DB values for Buhari Restaurant:");
  console.log("Debit:", customer.debit);
  console.log("Credit:", customer.credit);

  // Expected values from the ledger transactions + opening balance
  const expectedDebit = 135335;
  const expectedCredit = 119097;

  await Customer.findByIdAndUpdate(customer._id, {
    debit: expectedDebit,
    credit: expectedCredit
  });

  console.log("\nSuccessfully updated Buhari Restaurant's cached balances to:");
  console.log("Debit:", expectedDebit);
  console.log("Credit:", expectedCredit);
  console.log("Net Balance:", expectedDebit - expectedCredit);

  await mongoose.disconnect();
}

run();
