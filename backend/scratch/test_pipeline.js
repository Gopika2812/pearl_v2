import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({path: '../.env'});
import SalesOrder from '../models/SalesOrder.js';

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const aggregation = [
    { $match: { "items.name": { $regex: 'GNG Grains Foro L 1-5', $options: 'i' } } },
    { $sort: { createdAt: 1 } },
    { $limit: 50 },
    { $unwind: "$items" },
    { $match: { "items.name": { $regex: 'GNG Grains Foro L 1-5', $options: 'i' } } },
    {
      $lookup: {
        from: "products",
        localField: "items.productId",
        foreignField: "_id",
        as: "productInfo"
      }
    },
    { $unwind: "$productInfo" },
    {
      $addFields: {
        computedPurchasingPrice: {
          $let: {
            vars: {
              historyStats: {
                $reduce: {
                  input: { $ifNull: ["$productInfo.priceHistory", []] },
                  initialValue: {
                    bestBeforeDate: new Date(0),
                    bestBeforePrice: null,
                    earliestDate: new Date("2100-01-01T00:00:00Z"),
                    earliestOldPrice: null
                  },
                  in: {
                    bestBeforeDate: {
                      $cond: [
                        { $and: [
                            { $lte: ["$$this.effectiveDate", "$createdAt"] },
                            { $gt: ["$$this.effectiveDate", "$$value.bestBeforeDate"] }
                        ]},
                        "$$this.effectiveDate",
                        "$$value.bestBeforeDate"
                      ]
                    },
                    bestBeforePrice: {
                      $cond: [
                        { $and: [
                            { $lte: ["$$this.effectiveDate", "$createdAt"] },
                            { $gt: ["$$this.effectiveDate", "$$value.bestBeforeDate"] }
                        ]},
                        "$$this.newPurchasingPrice",
                        "$$value.bestBeforePrice"
                      ]
                    },
                    earliestDate: {
                      $cond: [
                        { $lt: ["$$this.effectiveDate", "$$value.earliestDate"] },
                        "$$this.effectiveDate",
                        "$$value.earliestDate"
                      ]
                    },
                    earliestOldPrice: {
                      $cond: [
                        { $lt: ["$$this.effectiveDate", "$$value.earliestDate"] },
                        "$$this.oldPurchasingPrice",
                        "$$value.earliestOldPrice"
                      ]
                    }
                  }
                }
              }
            },
            in: {
              $cond: [
                { $ne: ["$$historyStats.bestBeforePrice", null] },
                "$$historyStats.bestBeforePrice",
                {
                  $cond: [
                    { $ne: ["$$historyStats.earliestOldPrice", null] },
                    "$$historyStats.earliestOldPrice",
                    "$productInfo.purchasingPrice"
                  ]
                }
              ]
            }
          }
        }
      }
    },
    {
      $project: {
        createdAt: 1,
        productHistory: "$productInfo.priceHistory",
        computedPurchasingPrice: 1,
        currentPurchasingPrice: "$productInfo.purchasingPrice",
        historyStats: {
            $reduce: {
              input: { $ifNull: ["$productInfo.priceHistory", []] },
              initialValue: {
                bestBeforeDate: new Date(0),
                bestBeforePrice: null,
                earliestDate: new Date("2100-01-01T00:00:00Z"),
                earliestOldPrice: null
              },
              in: {
                bestBeforeDate: {
                  $cond: [
                    { $and: [
                        { $lte: ["$$this.effectiveDate", "$createdAt"] },
                        { $gt: ["$$this.effectiveDate", "$$value.bestBeforeDate"] }
                    ]},
                    "$$this.effectiveDate",
                    "$$value.bestBeforeDate"
                  ]
                },
                bestBeforePrice: {
                  $cond: [
                    { $and: [
                        { $lte: ["$$this.effectiveDate", "$createdAt"] },
                        { $gt: ["$$this.effectiveDate", "$$value.bestBeforeDate"] }
                    ]},
                    "$$this.newPurchasingPrice",
                    "$$value.bestBeforePrice"
                  ]
                },
                earliestDate: {
                  $cond: [
                    { $lt: ["$$this.effectiveDate", "$$value.earliestDate"] },
                    "$$this.effectiveDate",
                    "$$value.earliestDate"
                  ]
                },
                earliestOldPrice: {
                  $cond: [
                    { $lt: ["$$this.effectiveDate", "$$value.earliestDate"] },
                    "$$this.oldPurchasingPrice",
                    "$$value.earliestOldPrice"
                  ]
                }
              }
            }
        }
      }
    }
  ];

  const results = await SalesOrder.aggregate(aggregation);
  console.log(`Found ${results.length} results.`);
  results.forEach(r => {
      console.log(`Date: ${r.createdAt}, Computed Price: ${r.computedPurchasingPrice}, Current Price: ${r.currentPurchasingPrice}`);
      console.log(`  Stats: `, r.historyStats);
  });
  process.exit();
}).catch(console.error);
