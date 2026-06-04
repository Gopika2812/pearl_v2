import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const db = mongoose.connection.db;
    const user = await db.collection("branchusers").findOne({ name: /Gopika/i });
    if (!user) {
      console.log("Gopika not found");
      return;
    }

    const records = await db.collection("attendances").find({ employeeId: user._id }).toArray();
    console.log("All attendance records for Gopika:");
    records.forEach(r => {
      console.log(`ID: ${r._id}, Date: ${r.date}`);
      console.log(`Present Coords: ${r.presentLocation?.lat}, ${r.presentLocation?.lng}`);
      console.log(`Present Address: ${r.presentLocation?.address}`);
      console.log(`-----------------------------------`);
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
};

run();
