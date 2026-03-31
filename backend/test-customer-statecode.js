import dotenv from "dotenv";
import mongoose from "mongoose";
import Branch from "./models/Branch.js";
import Customer from "./models/Customer.js";
import Invoice from "./models/Invoice.js";

dotenv.config();

const testStateCode = async () => {
  try {
    console.log("\n🔍 CUSTOMER STATE CODE DIAGNOSTIC TEST\n");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    // 1. Check a specific customer
    console.log("📍 STEP 1: Checking Customer Data in Database\n");
    const customer = await Customer.findOne({ name: /VITTAL|vittal/i });
    
    if (customer) {
      console.log(`Customer Found: ${customer.name}`);
      console.log(`├─ State: ${customer.state}`);
      console.log(`├─ State Code: ${customer.stateCode || "❌ MISSING"}`);
      console.log(`├─ Pincode: ${customer.pincode}`);
      console.log(`├─ GSTIN: ${customer.gstin}`);
      console.log(`└─ ID: ${customer._id}\n`);

      if (!customer.stateCode) {
        console.log("⚠️  STATE CODE IS MISSING! Updating...\n");
        customer.stateCode = "33"; // Tamil Nadu
        await customer.save();
        console.log("✅ State code updated to 33 (Tamil Nadu)\n");
      }
    } else {
      console.log("❌ Customer not found\n");
    }

    // 2. Check branch data
    console.log("📍 STEP 2: Checking Branch Data\n");
    const branch = await Branch.findOne().limit(1);
    
    if (branch) {
      console.log(`Branch Found: ${branch.name}`);
      console.log(`├─ City: ${branch.city || "❌ MISSING"}`);
      console.log(`├─ State: ${branch.state || "❌ MISSING"}`);
      console.log(`├─ State Code: ${branch.stateCode || "❌ MISSING"}`);
      console.log(`├─ Pincode: ${branch.pincode || "❌ MISSING"}`);
      console.log(`├─ GSTIN: ${branch.gstin || "❌ MISSING"}`);
      console.log(`└─ ID: ${branch._id}\n`);
    }

    // 3. Check Invoice with populated data
    console.log("📍 STEP 3: Checking Invoice Data Flow\n");
    const invoice = await Invoice.findOne({ status: "FINALIZED" })
      .populate("branchId")
      .populate("customer.customerId");

    if (invoice) {
      console.log(`Invoice Found: ${invoice.invoiceNumber}`);
      console.log(`\n👥 Customer Data in Invoice:`);
      console.log(`├─ Name: ${invoice.customer?.name}`);
      console.log(`├─ State: ${invoice.customer?.state}`);
      console.log(`├─ State Code (from invoice): ${invoice.customer?.stateCode || "❌ MISSING"}`);
      
      if (invoice.customer?.customerId) {
        console.log(`├─ State Code (from master): ${invoice.customer.customerId.stateCode || "❌ MISSING"}`);
      }
      
      console.log(`\n🏢 Branch Data in Invoice:`);
      console.log(`├─ Name: ${invoice.branchId?.name}`);
      console.log(`├─ City: ${invoice.branchId?.city || "❌ MISSING"}`);
      console.log(`├─ State: ${invoice.branchId?.state || "❌ MISSING"}`);
      console.log(`├─ State Code: ${invoice.branchId?.stateCode || "❌ MISSING"}`);
      console.log(`└─ GSTIN: ${invoice.branchId?.gstin || "❌ MISSING"}\n`);

      // Check all required fields
      console.log("✅ REQUIRED FIELDS CHECK:\n");
      const checks = [
        ["Branch GSTIN", !!invoice.branchId?.gstin],
        ["Branch State Code", !!invoice.branchId?.stateCode],
        ["Branch City", !!invoice.branchId?.city],
        ["Branch Pincode", !!invoice.branchId?.pincode],
        ["Customer State Code", !!(invoice.customer?.stateCode || invoice.customer?.customerId?.stateCode)],
        ["Customer Pincode", !!invoice.customer?.pincode],
      ];

      checks.forEach(([field, isPresent]) => {
        console.log(`${isPresent ? "✅" : "❌"} ${field}`);
      });
      
      const allOk = checks.every(([_, isPresent]) => isPresent);
      console.log(`\n${allOk ? "✅ ALL FIELDS PRESENT - Ready for E-Invoice!" : "❌ MISSING FIELDS - Cannot generate E-Invoice"}\n`);
    } else {
      console.log("❌ No finalized invoice found\n");
    }

    // 4. Bulk check all customers
    console.log("📍 STEP 4: Checking All Customers in Branch\n");
    const allCustomers = await Customer.find().select("name state stateCode");
    const withoutStateCode = allCustomers.filter(c => !c.stateCode);
    
    console.log(`Total Customers: ${allCustomers.length}`);
    console.log(`With State Code: ${allCustomers.length - withoutStateCode.length}`);
    console.log(`Without State Code: ${withoutStateCode.length}\n`);

    if (withoutStateCode.length > 0) {
      console.log("❌ CUSTOMERS WITHOUT STATE CODE:\n");
      withoutStateCode.slice(0, 5).forEach(c => {
        console.log(`  - ${c.name} (State: ${c.state})`);
      });
      
      if (withoutStateCode.length > 5) {
        console.log(`  ... and ${withoutStateCode.length - 5} more\n`);
      }

      console.log("🔧 FIXING: Updating all customers...\n");
      const result = await Customer.updateMany(
        { stateCode: { $exists: false } },
        { $set: { stateCode: "33" } }
      );
      console.log(`✅ Updated ${result.modifiedCount} customers\n`);
    }

    console.log("✅ DIAGNOSTIC COMPLETE\n");

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB\n");
  }
};

testStateCode();
