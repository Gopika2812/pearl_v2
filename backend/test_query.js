import "./config/env.js";
import mongoose from "mongoose";
import Invoice from "./models/Invoice.js";
import Branch from "./models/Branch.js";

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB!");

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const goLiveDate = new Date("2026-05-20T00:00:00+05:30");

    const branches = await Branch.find({});
    console.log(`\nFound ${branches.length} branches in database:\n`);

    for (const branch of branches) {
      // 1. With Go-Live Filter
      const queryWithFilter = {
        deliveryStatus: "PENDING",
        status: { $in: ["FINALIZED", "PRINTED", "SENT"] },
        createdAt: { $lt: yesterday, $gte: goLiveDate },
        branchId: branch._id
      };
      const countWithFilter = await Invoice.countDocuments(queryWithFilter);

      // 2. Without Go-Live Filter
      const queryWithoutFilter = {
        deliveryStatus: "PENDING",
        status: { $in: ["FINALIZED", "PRINTED", "SENT"] },
        createdAt: { $lt: yesterday },
        branchId: branch._id
      };
      const countWithoutFilter = await Invoice.countDocuments(queryWithoutFilter);

      console.log(`Branch: "${branch.name}" (ID: ${branch._id})`);
      console.log(`  - Count with 2026-05-20 Go-Live filter: ${countWithFilter}`);
      console.log(`  - Count without filter (old query):       ${countWithoutFilter}\n`);
    }

    await mongoose.connection.close();
  } catch (error) {
    console.error("Error running test query:", error);
    process.exit(1);
  }
}

run();
