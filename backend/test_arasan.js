import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import Customer from "./models/Customer.js";

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const customers = await Customer.find({ name: { $regex: /arasan sweets,bakery & ice cream/i } });
  
  console.log("Found customers:");
  customers.forEach(c => {
    console.log(`- ID: ${c._id}, Name: "${c.name}", Balance: ${c.closingBalance}, Group: ${c.customerGroups}, Category: ${c.customerCategories}`);
  });

  process.exit(0);
});
