import "./config/env.js";
import mongoose from "mongoose";
import BranchUser from "./models/BranchUser.js";

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB");
  const user = await BranchUser.findOne({ username: "rohini@20" });
  console.log("User details:", JSON.stringify(user, null, 2));
  await mongoose.disconnect();
}

run();
