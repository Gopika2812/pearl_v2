import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const runSync = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb+srv://gopikap2812_db_user:3EprufLKuDVKIdo3@branchesdb.njfcfju.mongodb.net/pearls_erp?retryWrites=true&w=majority";
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    const endLimit = new Date();
    const financialYearStart = new Date("2026-04-01T00:00:00.000Z");

    const Customer = mongoose.connection.db.collection("customers");

    console.log("⏳ Running aggregation to compute exact true balances...");
    const balances = await Customer.aggregate([
      {
        $lookup: {
          from: "invoices",
          let: { cId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$customer.customerId", "$$cId"] },
                status: { $in: ["FINALIZED", "PRINTED", "SENT"] },
                $or: [
                  { invoiceDate: { $gte: financialYearStart, $lte: endLimit } },
                  { invoiceDate: { $exists: false }, createdAt: { $gte: financialYearStart, $lte: endLimit } }
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
                createdAt: { $gte: financialYearStart, $lte: endLimit }
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
                  { date: { $gte: financialYearStart, $lte: endLimit } },
                  { date: { $exists: false }, createdAt: { $gte: financialYearStart, $lte: endLimit } }
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
                  { journalDate: { $gte: financialYearStart, $lte: endLimit } },
                  { journalDate: { $exists: false }, createdAt: { $gte: financialYearStart, $lte: endLimit } }
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
                  { journalDate: { $gte: financialYearStart, $lte: endLimit } },
                  { journalDate: { $exists: false }, createdAt: { $gte: financialYearStart, $lte: endLimit } }
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
          netBalance: { $subtract: ["$debit", "$credit"] }
        }
      }
    ]).toArray();

    console.log(`✅ Aggregation completed for ${balances.length} customers.`);
    console.log("⏳ Applying bulk updates...");

    let bulkOps = [];
    let updatedCount = 0;
    
    for (const b of balances) {
      // In Pearl ERP, the standard is netBalance = debit - credit
      // If we store it directly:
      const newDebit = Math.max(0, b.netBalance);
      const newCredit = Math.max(0, -b.netBalance);
      const newClosingBalance = b.netBalance;

      bulkOps.push({
        updateOne: {
          filter: { _id: b._id },
          update: { 
            $set: { 
              debit: newDebit, 
              credit: newCredit, 
              closingBalance: newClosingBalance,
              totalBalance: newClosingBalance
            } 
          }
        }
      });

      if (bulkOps.length === 500) {
        await Customer.bulkWrite(bulkOps);
        updatedCount += bulkOps.length;
        console.log(`...updated ${updatedCount} customers`);
        bulkOps = [];
      }
    }

    if (bulkOps.length > 0) {
      await Customer.bulkWrite(bulkOps);
      updatedCount += bulkOps.length;
      console.log(`...updated ${updatedCount} customers`);
    }

    console.log(`🎉 Successfully synced balances for ${updatedCount} customers!`);
    process.exit(0);

  } catch (err) {
    console.error("❌ Sync Error:", err);
    process.exit(1);
  }
};

runSync();
