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

  const branchObjectId = customer.branchId;
  const objectIds = [customer._id];
  const toDate = "2026-06-08";
  const fromDate = "2026-04-01";
  const endLimit = new Date(toDate);

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
              status: { $in: ["FINALIZED", "PRINTED", "SENT"] },
              ...(fromDate && toDate ? {
                invoiceDate: { $gte: new Date(fromDate), $lte: new Date(toDate) }
              } : {})
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
              status: "confirmed",
              ...(fromDate && toDate ? {
                createdAt: { $gte: new Date(fromDate), $lte: new Date(toDate) }
              } : {})
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
      $lookup: {
        from: "invoices",
        let: { cId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$customer.customerId", "$$cId"] },
              status: "FINALIZED",
              $or: [
                { invoiceDate: { $gte: new Date("2026-04-01T00:00:00.000Z"), $lte: endLimit } },
                { invoiceDate: { $exists: false }, createdAt: { $gte: new Date("2026-04-01T00:00:00.000Z"), $lte: endLimit } }
              ]
            }
          },
          { $group: { _id: null, total: { $sum: "$grandTotal" } } }
        ],
        as: "invoicesUpToToDate"
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
              status: { $in: ["confirmed", "bounced"] },
              createdAt: { $gte: new Date("2026-04-01T00:00:00.000Z"), $lte: endLimit }
            }
          },
          {
            $group: {
              _id: null,
              confirmedTotal: {
                $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, "$amount", 0] }
              },
              bouncedTotal: {
                $sum: { $cond: [{ $eq: ["$status", "bounced"] }, "$amount", 0] }
              }
            }
          }
        ],
        as: "receiptsUpToToDate"
      }
    },
    {
      $lookup: {
        from: "creditnotes",
        let: { cId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$customer.customerId", "$$cId"] },
              status: "Created",
              $or: [
                { date: { $gte: new Date("2026-04-01T00:00:00.000Z"), $lte: endLimit } },
                { date: { $exists: false }, createdAt: { $gte: new Date("2026-04-01T00:00:00.000Z"), $lte: endLimit } }
              ]
            }
          },
          { $group: { _id: null, total: { $sum: "$grandTotal" } } }
        ],
        as: "cnsUpToToDate"
      }
    },
    {
      $lookup: {
        from: "manualjournals",
        let: { cId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$by.partyType", "DEBTOR"] },
                  { $or: [
                    { $eq: ["$by.partyId", "$$cId"] },
                    { $eq: ["$by.partyId", { $toString: "$$cId" }] }
                  ] }
                ]
              },
              $or: [
                { journalDate: { $gte: new Date("2026-04-01T00:00:00.000Z"), $lte: endLimit } },
                { journalDate: { $exists: false }, createdAt: { $gte: new Date("2026-04-01T00:00:00.000Z"), $lte: endLimit } }
              ]
            }
          },
          { $group: { _id: null, total: { $sum: "$amount" } } }
        ],
        as: "mjsDrUpToToDate"
      }
    },
    {
      $lookup: {
        from: "manualjournals",
        let: { cId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$to.partyType", "DEBTOR"] },
                  { $or: [
                    { $eq: ["$to.partyId", "$$cId"] },
                    { $eq: ["$to.partyId", { $toString: "$$cId" }] }
                  ] }
                ]
              },
              $or: [
                { journalDate: { $gte: new Date("2026-04-01T00:00:00.000Z"), $lte: endLimit } },
                { journalDate: { $exists: false }, createdAt: { $gte: new Date("2026-04-01T00:00:00.000Z"), $lte: endLimit } }
              ]
            }
          },
          { $group: { _id: null, total: { $sum: "$amount" } } }
        ],
        as: "mjsCrUpToToDate"
      }
    },
    {
      $project: {
        _id: 1,
        totalSalesInvoice: { $ifNull: [{ $arrayElemAt: ["$invoiceSum.total", 0] }, 0] },
        totalReceiptValue: { $ifNull: [{ $arrayElemAt: ["$receiptSum.total", 0] }, 0] },
        openingBalance: { $ifNull: ["$openingBalance", 0] },
        invTotal: { $ifNull: [{ $arrayElemAt: ["$invoicesUpToToDate.total", 0] }, 0] },
        recConfirmedTotal: { $ifNull: [{ $arrayElemAt: ["$receiptsUpToToDate.confirmedTotal", 0] }, 0] },
        recBouncedTotal: { $ifNull: [{ $arrayElemAt: ["$receiptsUpToToDate.bouncedTotal", 0] }, 0] },
        cnTotal: { $ifNull: [{ $arrayElemAt: ["$cnsUpToToDate.total", 0] }, 0] },
        mjDrTotal: { $ifNull: [{ $arrayElemAt: ["$mjsDrUpToToDate.total", 0] }, 0] },
        mjCrTotal: { $ifNull: [{ $arrayElemAt: ["$mjsCrUpToToDate.total", 0] }, 0] }
      }
    },
    {
      $project: {
        _id: 1,
        totalSalesInvoice: 1,
        totalReceiptValue: 1,
        debit: {
          $add: [
            { $cond: [{ $gt: ["$openingBalance", 0] }, "$openingBalance", 0] },
            "$invTotal",
            "$recBouncedTotal",
            "$mjDrTotal"
          ]
        },
        credit: {
          $add: [
            { $cond: [{ $lt: ["$openingBalance", 0] }, { $abs: "$openingBalance" }, 0] },
            "$recConfirmedTotal",
            "$cnTotal",
            "$mjCrTotal"
          ]
        }
      }
    },
    {
      $project: {
        _id: 1,
        debit: 1,
        credit: 1,
        netBalance: { $subtract: ["$debit", "$credit"] },
        totalSalesInvoice: 1,
        totalReceiptValue: 1
      }
    }
  ]);

  console.log("Calculated Dynamic Balances for Buhari Restaurant:");
  console.log(JSON.stringify(balances, null, 2));

  await mongoose.disconnect();
}

run();
