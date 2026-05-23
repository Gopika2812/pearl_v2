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

async function run() {
  console.log("Connecting...");
  await mongoose.connect(MONGO_URI);
  console.log("Connected!");

  const customer = await Customer.findOne({ name: /Subash/i });
  console.log("Customer Id:", customer._id);

  const branchObjectId = customer.branchId;
  const objectIds = [customer._id];

  const balances = await Customer.aggregate([
    { $match: { _id: { $in: objectIds }, branchId: branchObjectId } },
    {
      $lookup: {
        from: "invoices",
        let: { cId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$customer.customerId", "$$cId"] },
              status: { $in: ["FINALIZED", "PRINTED", "SENT"] }
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$grandTotal" }
            }
          }
        ],
        as: "invoiceSum"
      }
    },
    {
      $lookup: {
        from: "receipts",
        let: { cId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$customer.customerId", "$$cId"] },
              status: "confirmed"
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$amount" }
            }
          }
        ],
        as: "receiptSum"
      }
    },
    {
      $project: {
        _id: 1,
        debit: { $ifNull: ["$debit", 0] },
        credit: { $ifNull: ["$credit", 0] },
        netBalance: { $subtract: [{ $ifNull: ["$debit", 0] }, { $ifNull: ["$credit", 0] }] },
        totalSalesInvoice: { $ifNull: [{ $arrayElemAt: ["$invoiceSum.total", 0] }, 0] },
        totalReceiptValue: { $ifNull: [{ $arrayElemAt: ["$receiptSum.total", 0] }, 0] }
      }
    }
  ]);

  console.log("Aggregation output:", JSON.stringify(balances, null, 2));

  await mongoose.disconnect();
  console.log("Disconnected!");
}

run().catch(console.error);
