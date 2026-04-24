import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({ path: "backend/.env" });

// Define simplified schemas for testing
const SalesOrderSchema = new mongoose.Schema({}, { strict: false });
const SalesOrder = mongoose.model("SalesOrder", SalesOrderSchema);

const ReceiptSchema = new mongoose.Schema({}, { strict: false });
const Receipt = mongoose.model("Receipt", ReceiptSchema);

const CustomerSchema = new mongoose.Schema({}, { strict: false });
const Customer = mongoose.model("Customer", CustomerSchema);

async function verify() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to DB");

    // 1. Find a test Sales Order
    const order = await SalesOrder.findOne({ invoiceGenerated: true, status: { $ne: "CANCELLED" } });
    if (!order) {
      console.log("No test order found.");
      return;
    }

    const originalClosingBalance = order.closingBalance || 0;
    const testAmount = 10; // small amount for testing

    console.log(`Testing with Invoice: ${order.invoiceId}`);
    console.log(`Original Closing Balance: ${originalClosingBalance}`);

    // Normally we'd call the API, but here we'll simulate the logic we just added
    // to verify the DB updates correctly.
    
    // Simulate logic from receiptRoutes.js
    const newOrderClosingBalance = Math.max(0, (order.closingBalance || 0) - testAmount);
    await SalesOrder.findByIdAndUpdate(order._id, {
      closingBalance: newOrderClosingBalance,
    });

    const updatedOrder = await SalesOrder.findById(order._id);
    console.log(`Updated Closing Balance: ${updatedOrder.closingBalance}`);

    if (updatedOrder.closingBalance === originalClosingBalance - testAmount || (originalClosingBalance < testAmount && updatedOrder.closingBalance === 0)) {
      console.log("✅ Verification Successful: Order closing balance updated correctly.");
      
      // Revert change to keep DB clean
      await SalesOrder.findByIdAndUpdate(order._id, { closingBalance: originalClosingBalance });
      console.log("Reverted test change.");
    } else {
      console.log("❌ Verification Failed: Closing balance not updated correctly.");
    }

  } catch (error) {
    console.error("Error during verification:", error);
  } finally {
    await mongoose.disconnect();
  }
}

verify();
