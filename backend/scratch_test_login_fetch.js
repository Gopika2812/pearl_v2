import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import BranchUser from "./models/BranchUser.js";
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "pearls_foods_frozen_2026_secret_key";
const MONGO_URI = process.env.MONGO_URI;

async function test() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to DB");

  const user = await BranchUser.findOne({ username: "rohini@20" });

  if (!user) {
    console.error("User rohini@20 not found");
    process.exit(1);
  }

  console.log("Found user:", user.username, "Role:", user.role, "Branch:", user.branch);

  const token = jwt.sign(
    {
      id: user._id,
      username: user.username,
      role: user.role,
      branch: user.branch,
      allowedPages: user.allowedPages || [],
      fieldPermissions: user.fieldPermissions || {},
      actionPermissions: user.actionPermissions || {},
      allowedVoucherTypes: user.allowedVoucherTypes || [],
      allowedBranches: user.allowedBranches || [],
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  const branchId = user.branch.toString();
  const endpoints = [
    `/api/customers?branchId=${branchId}&page=1&limit=100&search=`,
    `/api/customer-categories?branchId=${branchId}`,
    `/api/customer-groups?branchId=${branchId}`,
    `/api/sales-owners?branchId=${branchId}`,
  ];

  for (const ep of endpoints) {
    try {
      const url = `http://localhost:5000${ep}`;
      const res = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const status = res.status;
      const text = await res.text();
      console.log(`\nEndpoint: ${ep}`);
      console.log(`Status: ${status}`);
      console.log(`Response length: ${text.length}`);
      if (status !== 200) {
        console.log(`Response: ${text}`);
      }
    } catch (e) {
      console.error(`Error requesting ${ep}:`, e.message);
    }
  }

  await mongoose.disconnect();
}

test();
