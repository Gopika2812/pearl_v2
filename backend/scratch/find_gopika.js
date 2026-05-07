import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

// Define Schemas
const userSchema = new mongoose.Schema({ name: String, role: String });
const employeeSchema = new mongoose.Schema({ name: String, role: String });

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB");

  const BranchUser = mongoose.model("BranchUser", userSchema, "branchusers");
  const HREmployee = mongoose.model("HREmployee", employeeSchema, "hremployeeprofiles");

  const users = await BranchUser.find({ name: /Gopika/i });
  const employees = await HREmployee.find({ name: /Gopika/i });

  console.log("Users found:", users);
  console.log("Employees found:", employees);

  process.exit();
};

run();
