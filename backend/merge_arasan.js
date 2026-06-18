import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import Customer from "./models/Customer.js";
import SalesOrder from "./models/SalesOrder.js";
import Invoice from "./models/Invoice.js";
import Receipt from "./models/Receipt.js";
import CreditNote from "./models/CreditNote.js";
import FollowUp from "./models/FollowUp.js";
import CustomerLockedPrice from "./models/CustomerLockedPrice.js";

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const sourceId = "6a11bf56d0bad4ac16807ca0";
    const targetId = "69cc826d90a268b9a0b7bb5a";

    const source = await Customer.findById(sourceId).session(session);
    const target = await Customer.findById(targetId).session(session);

    console.log(`🚀 Merging "${source.name}" into "${target.name}"`);

    // 1. Update Documents
    const updateCriteria = { "customer.customerId": source._id };
    const updatePayload = { $set: { "customer.customerId": target._id, "customer.name": target.name } };

    await SalesOrder.updateMany(updateCriteria, updatePayload, { session });
    await Invoice.updateMany(updateCriteria, updatePayload, { session });
    await Receipt.updateMany(updateCriteria, updatePayload, { session });
    await CreditNote.updateMany(updateCriteria, updatePayload, { session });

    // 2. Update Direct References
    await FollowUp.updateMany({ customerId: source._id }, { $set: { customerId: target._id } }, { session });
    await CustomerLockedPrice.updateMany({ customerId: source._id }, { $set: { customerId: target._id } }, { session });

    // 3. Consolidate Balances
    const sourceDebit = source.debit || 0;
    const sourceCredit = source.credit || 0;

    target.debit = (target.debit || 0) + sourceDebit;
    target.credit = (target.credit || 0) + sourceCredit;
    target.closingBalance = (target.debit - target.credit);
    target.totalBalance = target.closingBalance;

    await target.save({ session });

    // 4. Delete Source
    await Customer.findByIdAndDelete(source._id, { session });

    await session.commitTransaction();
    session.endSession();

    console.log("Successfully merged!");
    process.exit(0);
  } catch (err) {
    console.error("Merge error:", err);
    await session.abortTransaction();
    session.endSession();
    process.exit(1);
  }
});
