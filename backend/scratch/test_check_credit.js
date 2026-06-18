import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });
import Customer from "../models/Customer.js";

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const customer = await Customer.findOne({ name: "Hotel Sri Annamalayaar Park A/c (Junction)" });
  if (!customer) {
    console.log("Customer not found");
  } else {
    console.log("debit:", customer.debit);
    console.log("credit:", customer.credit);
    console.log("creditLimit:", customer.creditLimit);
    console.log("creditLimitDays:", customer.creditLimitDays);
    console.log("isCreditBypassed:", customer.isCreditBypassed);
    console.log("openingBalance:", customer.openingBalance);
  }
  process.exit(0);
});
