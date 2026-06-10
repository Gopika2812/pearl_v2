import "../config/env.js";
import mongoose from "mongoose";
import BranchUser from "../models/BranchUser.js";

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB");
  const users = await BranchUser.find({}).select("username role branchId").lean();
  console.log("Users:", JSON.stringify(users, null, 2));
  await mongoose.disconnect();
}

run();
