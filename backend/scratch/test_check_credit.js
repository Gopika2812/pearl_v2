import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });
import Customer from "../models/Customer.js";

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const customer = await Customer.findOne({ name: "Famous Enterprises (Junction)" });
  console.log("debit:", customer.debit);
  console.log("credit:", customer.credit);
  console.log("closingBalance:", customer.closingBalance);
  
  const currentBalance = customer.closingBalance !== undefined && customer.closingBalance !== null
      ? customer.closingBalance 
      : ((customer.debit || 0) - (customer.credit || 0));
  
  console.log("currentBalance logic:", currentBalance);
  process.exit(0);
});
