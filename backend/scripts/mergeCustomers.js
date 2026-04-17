import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load models
import Customer from '../models/Customer.js';
import SalesOrder from '../models/SalesOrder.js';
import Invoice from '../models/Invoice.js';
import Receipt from '../models/Receipt.js';
import CreditNote from '../models/CreditNote.js';
import FollowUp from '../models/FollowUp.js';
import CustomerLockedPrice from '../models/CustomerLockedPrice.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/pearls_erp';

const MASTER_ID = '69dcbb75c21f8963ebb2b706';
const DUPLICATE_ID = '69cc826d90a268b9a0b7bb77';

async function merge() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('🚀 Connected to MongoDB');

    const master = await Customer.findById(MASTER_ID);
    const duplicate = await Customer.findById(DUPLICATE_ID);

    if (!master) {
      console.error('❌ Master customer not found');
      process.exit(1);
    }

    if (!duplicate) {
      console.warn('⚠️ Duplicate customer record NOT found in database. This is an Orphan transaction case.');
      console.log('We will redirect all orphaned transactions to the Master.');
    } else {
      console.log(`📝 Merging "${duplicate.name}" (${DUPLICATE_ID}) into "${master.name}" (${MASTER_ID})`);
    }

    // Start session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Update SalesOrders
      const soResults = await SalesOrder.updateMany(
        { "customer.customerId": DUPLICATE_ID },
        { $set: { "customer.customerId": master._id, "customer.name": master.name } },
        { session }
      );
      console.log(`✅ Updated ${soResults.modifiedCount} SalesOrders`);

      // 2. Update Invoices
      const invResults = await Invoice.updateMany(
        { "customer.customerId": DUPLICATE_ID },
        { $set: { "customer.customerId": master._id, "customer.name": master.name } },
        { session }
      );
      console.log(`✅ Updated ${invResults.modifiedCount} Invoices`);

      // 3. Update Receipts
      const rcpResults = await Receipt.updateMany(
        { "customer.customerId": DUPLICATE_ID },
        { $set: { "customer.customerId": master._id, "customer.name": master.name } },
        { session }
      );
      console.log(`✅ Updated ${rcpResults.modifiedCount} Receipts`);

      // 4. Update CreditNotes
      const cnResults = await CreditNote.updateMany(
        { "customer.customerId": DUPLICATE_ID },
        { $set: { "customer.customerId": master._id, "customer.name": master.name } },
        { session }
      );
      console.log(`✅ Updated ${cnResults.modifiedCount} CreditNotes`);

      // 5. Update FollowUps
      const fuResults = await FollowUp.updateMany(
        { customerId: DUPLICATE_ID },
        { $set: { customerId: master._id } },
        { session }
      );
      console.log(`✅ Updated ${fuResults.modifiedCount} FollowUps`);

      // 6. Update Locked Prices
      const lpResults = await CustomerLockedPrice.updateMany(
        { customerId: DUPLICATE_ID },
        { $set: { customerId: master._id } },
        { session }
      );
      console.log(`✅ Updated ${lpResults.modifiedCount} CustomerLockedPrices`);

      // 7. Consolidate Balances
      // Since duplicate record might be missing, we should only add if it exists.
      // However, if the transactions are currently NOT reflected in Master's balance, we should add them?
      // Normally, if a receipt was created for a different customer ID, its amount was subtracted from THAT ID's balance.
      // If we move the receipts to the Master ID, we must also subtract that amount from the Master's balance.
      const receiptsToMove = await Receipt.find({ "customer.customerId": DUPLICATE_ID }).session(session);
      const totalCreditToMove = receiptsToMove.reduce((sum, r) => sum + (r.amount || 0), 0);
      
      console.log(`💰 Found ₹${totalCreditToMove} in orphaned Receipts to move.`);

      const newCredit = (master.credit || 0) + totalCreditToMove;
      const newClosingBalance = (master.closingBalance || 0) - totalCreditToMove;

      await Customer.findByIdAndUpdate(MASTER_ID, {
        $set: {
          credit: newCredit,
          closingBalance: newClosingBalance,
          totalBalance: newClosingBalance
        }
      }, { session });
      console.log(`✅ Master balance updated: Credit=${newCredit}, ClosingBalance=${newClosingBalance}`);

      // 8. Delete Duplicate (if exists)
      if (duplicate) {
        await Customer.findByIdAndDelete(DUPLICATE_ID, { session });
        console.log(`✅ Deleted duplicate customer record`);
      }

      await session.commitTransaction();
      console.log('🎉 Merge/Redirect completed successfully!');
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

  } catch (err) {
    console.error('❌ Error during merge:', err);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

merge();
