import mongoose from "mongoose";
import dotenv from "dotenv";
import Branch from "../models/Branch.js";
import Invoice from "../models/Invoice.js";

dotenv.config();

async function run() {
  try {
    console.log("Connecting to Database...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected successfully.");

    // Fetch a branch ID
    const branch = await Branch.findOne().lean();
    if (!branch) {
      console.log("No branches found in database!");
      process.exit(1);
    }
    console.log(`Using branch: ${branch.name} (${branch._id})`);

    const branchId = branch._id.toString();
    const page = 1;
    const limit = 500;
    const skip = (page - 1) * limit;
    const limitNum = limit;

    const matchQuery = {
      branchId: new mongoose.Types.ObjectId(branchId),
      status: { $in: ["FINALIZED", "PRINTED", "SENT"] }
    };

    console.log("Building base aggregation pipeline...");
    const baseAggregation = [
      { $match: matchQuery },
      { $unwind: "$items" },
    ];

    baseAggregation.push(
      {
        $lookup: {
          from: "products",
          localField: "items.productId",
          foreignField: "_id",
          as: "productInfo"
        }
      },
      { $unwind: "$productInfo" }
    );

    baseAggregation.push(
      {
        $lookup: {
          from: "productgroups",
          localField: "productInfo.productGroup",
          foreignField: "_id",
          as: "groupInfo"
        }
      },
      {
        $unwind: {
          path: "$groupInfo",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          date: "$invoiceDate",
          invoiceNumber: 1,
          voucherType: 1,
          customerName: "$customer.name",
          productName: "$items.name",
          productGroupName: "$groupInfo.name",
          purchasingPrice: "$productInfo.purchasingPrice",
          gst: "$items.gst",
          qty: "$items.qty",
          sellingPrice: "$items.sellingPrice",
          discountAmount: "$items.discountAmount",
          discountPerUnit: {
            $cond: [
              { $gt: ["$items.qty", 0] },
              { $divide: ["$items.discountAmount", "$items.qty"] },
              0
            ]
          },
          grossProfit: {
            $subtract: [
              {
                $subtract: [
                  "$items.sellingPrice",
                  {
                    $cond: [
                      { $gt: ["$items.qty", 0] },
                      { $divide: ["$items.discountAmount", "$items.qty"] },
                      0
                    ]
                  }
                ]
              },
              "$productInfo.purchasingPrice"
            ]
          }
        }
      },
      {
        $addFields: {
          profitPercent: {
            $cond: [
              { $gt: ["$purchasingPrice", 0] },
              { $multiply: [{ $divide: ["$grossProfit", "$purchasingPrice"] }, 100] },
              0
            ]
          }
        }
      }
    );

    console.log("Running Query 1: Count aggregate pipeline...");
    const countPipeline = [
      ...baseAggregation,
      { $count: "total" }
    ];
    const countResult = await Invoice.aggregate(countPipeline).allowDiskUse(true);
    const total = countResult[0]?.total || 0;
    console.log("✅ Count aggregate completed successfully! Total:", total);

    console.log("Running Query 2: Data aggregate pipeline...");
    const sortObj = { date: -1 };
    const dataPipeline = [
      ...baseAggregation,
      { $sort: sortObj },
      { $skip: skip },
      { $limit: limitNum }
    ];
    const history = await Invoice.aggregate(dataPipeline).allowDiskUse(true);
    console.log("✅ Data aggregate completed successfully! Retrieved size:", history.length);

    if (history.length > 0) {
      console.log("Sample transaction record:", {
        invoiceNumber: history[0].invoiceNumber,
        productName: history[0].productName,
        qty: history[0].qty,
        grossProfit: history[0].grossProfit
      });
    }
  } catch (error) {
    console.error("❌ Aggregation Error Captured:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected.");
  }
}

run();
