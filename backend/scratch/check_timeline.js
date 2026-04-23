import mongoose from "mongoose";
import dotenv from "dotenv";
import SalesOrder from "../models/SalesOrder.js";

dotenv.config();

async function check() {
  try {
    const uri = process.env.MONGO_URI;
    await mongoose.connect(uri);
    
    console.log("📅 --- Daily Sales Order Count ---");
    const timeline = await SalesOrder.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date("2026-04-01") }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } }
    ]);

    timeline.forEach(day => {
      console.log(`${day._id}: ${day.count} orders`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
