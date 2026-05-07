import mongoose from "mongoose";
import TallyJournal from "./backend/models/TallyJournal.js";
import "./backend/config/env.js";

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const count = await TallyJournal.countDocuments();
  const sample = await TallyJournal.findOne();
  console.log("Total TallyJournals:", count);
  console.log("Sample Journal:", JSON.stringify(sample, null, 2));
  process.exit(0);
}
check();
