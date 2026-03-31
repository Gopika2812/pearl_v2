import dotenv from "dotenv";
import mongoose from "mongoose";
import Customer from "./models/Customer.js";

dotenv.config();

const verifyStateCodeSave = async () => {
  try {
    console.log("\n🔍 VERIFYING STATE CODE SAVE\n");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    // Find the VITTAL customer
    const customer = await Customer.findOne({ name: /VITTAL/i });

    if (customer) {
      console.log("📊 CUSTOMER RECORD:\n");
      console.log(`Name: ${customer.name}`);
      console.log(`State: ${customer.state}`);
      console.log(`State Code: ${customer.stateCode || "❌ NOT FOUND"}`);
      console.log(`Pincode: ${customer.pincode}`);
      console.log(`GSTIN: ${customer.gstin}`);
      console.log(`ID: ${customer._id}`);
      console.log(`Updated At: ${customer.updatedAt}\n`);

      if (customer.stateCode) {
        console.log("✅ STATE CODE IS SAVED IN DATABASE\n");
        console.log("📋 Full customer data from DB:");
        console.log(JSON.stringify({
          name: customer.name,
          state: customer.state,
          stateCode: customer.stateCode,
          pincode: customer.pincode,
          gstin: customer.gstin,
          address: customer.address,
        }, null, 2));
      } else {
        console.log("❌ STATE CODE IS NOT SAVED!\n");
        console.log("🔧 Attempting to fix...\n");
        customer.stateCode = "33";
        await customer.save();
        console.log("✅ Updated stateCode to 33\n");
      }
    } else {
      console.log("❌ Customer VITTAL not found\n");
    }

    // Check ALL customers without stateCode
    console.log("\n📍 Checking all customers for missing stateCode:\n");
    const customersWithoutStateCode = await Customer.find({
      $or: [
        { stateCode: null },
        { stateCode: "" },
        { stateCode: { $exists: false } }
      ]
    }).select("name state stateCode").limit(10);

    if (customersWithoutStateCode.length > 0) {
      console.log(`❌ Found ${customersWithoutStateCode.length} customers without stateCode:\n`);
      customersWithoutStateCode.forEach(c => {
        console.log(`  - ${c.name} (State: ${c.state}, Code: ${c.stateCode || "MISSING"})`);
      });
    } else {
      console.log("✅ All customers have stateCode!\n");
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB\n");
  }
};

verifyStateCodeSave();
