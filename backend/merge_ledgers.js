import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

// Models
import Vendor from './models/Vendor.js';
import PurchaseOrder from './models/PurchaseOrder.js';
import PurchaseInvoice from './models/PurchaseInvoice.js';
import Payment from './models/Payment.js';
import DebitNote from './models/DebitNote.js';
import Customer from './models/Customer.js';

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const targetIdStr = '69cc2c77b0ce728ac889dc08'; // PEARLAGENCY
    const sourceIdStr = '6a39edf61f8877d5f967828b'; // Pearl Agency (duplicate)
    
    const targetId = new mongoose.Types.ObjectId(targetIdStr);
    const sourceId = new mongoose.Types.ObjectId(sourceIdStr);
    
    const targetVendor = await Vendor.findById(targetId).session(session);
    const sourceVendor = await Vendor.findById(sourceId).session(session);
    
    if (!targetVendor || !sourceVendor) {
      throw new Error("One or both vendors not found");
    }
    
    console.log(`Target vendor starting balance: D:${targetVendor.debit} C:${targetVendor.credit}`);
    console.log(`Source vendor starting balance: D:${sourceVendor.debit} C:${sourceVendor.credit}`);

    // Update PurchaseOrders
    const poResult = await PurchaseOrder.updateMany(
      { vendorId: sourceId },
      { 
        $set: { 
          vendorId: targetId,
          vendor: "Pearl Agency" 
        } 
      },
      { session }
    );
    console.log(`Updated PurchaseOrders: ${poResult.modifiedCount}`);

    // Also update existing target POs to have proper name
    await PurchaseOrder.updateMany(
      { vendorId: targetId },
      { $set: { vendor: "Pearl Agency" } },
      { session }
    );

    // Update PurchaseInvoices
    const piResult = await PurchaseInvoice.updateMany(
      { vendorId: sourceId },
      { 
        $set: { 
          vendorId: targetId,
          vendor: "Pearl Agency"
        } 
      },
      { session }
    );
    console.log(`Updated PurchaseInvoices: ${piResult.modifiedCount}`);
    
    // Also update existing target PIs
    await PurchaseInvoice.updateMany(
      { vendorId: targetId },
      { $set: { vendor: "Pearl Agency" } },
      { session }
    );

    // Update Payments
    const payResult1 = await Payment.updateMany(
      { vendorId: sourceId },
      { $set: { vendorId: targetId } },
      { session }
    );
    // Since payment schema might have vendor.vendorId
    const payResult2 = await Payment.updateMany(
      { "vendor.vendorId": sourceId },
      { 
        $set: { 
          "vendor.vendorId": targetId,
          "vendor.name": "Pearl Agency" 
        } 
      },
      { session }
    );
    console.log(`Updated Payments (top-level): ${payResult1.modifiedCount}, (nested): ${payResult2.modifiedCount}`);

    // Also update existing target Payments
    await Payment.updateMany(
      { "vendor.vendorId": targetId },
      { $set: { "vendor.name": "Pearl Agency" } },
      { session }
    );

    // Update DebitNotes
    const dnResult = await DebitNote.updateMany(
      { "vendor.vendorId": sourceId },
      { 
        $set: { 
          "vendor.vendorId": targetId,
          "vendor.name": "Pearl Agency"
        } 
      },
      { session }
    );
    console.log(`Updated DebitNotes: ${dnResult.modifiedCount}`);

    // Also update existing target DebitNotes
    await DebitNote.updateMany(
      { "vendor.vendorId": targetId },
      { $set: { "vendor.name": "Pearl Agency" } },
      { session }
    );

    // Update Customers (if any linked to this vendor)
    const cusResult = await Customer.updateMany(
      { linkedVendorId: sourceId },
      { $set: { linkedVendorId: targetId } },
      { session }
    );
    console.log(`Updated Customers: ${cusResult.modifiedCount}`);

    // Delete source vendor first to avoid duplicate key error on name
    await Vendor.deleteOne({ _id: sourceId }).session(session);
    console.log(`Deleted source vendor ${sourceIdStr}`);

    // Consolidate Vendor Balances
    targetVendor.debit += sourceVendor.debit || 0;
    targetVendor.credit += sourceVendor.credit || 0;
    
    // Move linking fields
    targetVendor.linkedBranchId = sourceVendor.linkedBranchId || targetVendor.linkedBranchId;
    targetVendor.isBranchVendor = sourceVendor.isBranchVendor || targetVendor.isBranchVendor;
    
    // Final rename
    targetVendor.name = "Pearl Agency";
    
    await targetVendor.save({ session });
    console.log(`Target vendor new balance: D:${targetVendor.debit} C:${targetVendor.credit}`);

    await session.commitTransaction();
    console.log("Merge completed successfully!");
    session.endSession();
    process.exit(0);

  } catch (err) {
    console.error("Merge failed, aborting transaction", err);
    await session.abortTransaction();
    session.endSession();
    process.exit(1);
  }

}).catch(console.error);
