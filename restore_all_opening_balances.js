const mongoose = require('mongoose');
const dotEnv = require('dotenv');
dotEnv.config({ path: 'backend/.env' });

async function restoreAll() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("🚀 Starting Balance Recovery...");

    const Customer = mongoose.connection.db.collection('customers');
    const SalesOrder = mongoose.connection.db.collection('salesorders');
    const Receipt = mongoose.connection.db.collection('receipts');
    const CreditNote = mongoose.connection.db.collection('creditnotes');

    const customers = await Customer.find({}).toArray();
    console.log(`Found ${customers.length} customers. Starting reconciliation...`);

    // Target reference date: March 31st 2026 (same as user's screenshot)
    // IST midnight = Feb 28 18:30 UTC
    const cutoffDate = new Date("2026-03-31T00:00:00.000Z");

    for (const customer of customers) {
      if (customer.name.includes("DHIVYAA")) {
        console.log(`Skipping ${customer.name} (already fixed)`);
        continue;
      }

      // 1. Get current live balance
      const currentBalance = (customer.debit || 0) - (customer.credit || 0);

      // 2. Find Sales after cutoff
      const sales = await SalesOrder.find({
        "customer.customerId": customer._id,
        status: "INVOICED",
        createdAt: { $gte: cutoffDate }
      }).toArray();

      const totalSales = sales.reduce((sum, s) => {
        const amt = s.lastInvoicedGrandTotal !== undefined ? s.lastInvoicedGrandTotal : (s.invoiceGrandTotal || s.grandTotal || 0);
        return sum + amt;
      }, 0);

      // 3. Find Credits after cutoff
      const receipts = await Receipt.find({
        "customer.customerId": customer._id,
        status: "confirmed",
        createdAt: { $gte: cutoffDate }
      }).toArray();
      const cns = await CreditNote.find({
        "customer.customerId": customer._id,
        status: "Created",
        createdAt: { $gte: cutoffDate }
      }).toArray();

      const totalCredits = 
        receipts.reduce((sum, r) => sum + (r.amount || 0), 0) +
        cns.reduce((sum, cn) => sum + (cn.grandTotal || 0), 0);

      // 4. Calculate what the Opening Balance B/F would have been on 31st March
      // Opening = Today - NewSales + NewCredits
      const restoredOpening = currentBalance - totalSales + totalCredits;

      await Customer.updateOne(
        { _id: customer._id },
        { 
          $set: { 
            openingBalance: Math.round(restoredOpening * 100) / 100,
            manualOpeningDate: cutoffDate
          } 
        }
      );
    }

    console.log("✅ All Opening Balances restored and anchored at March 31st.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Recovery Error:", err);
    process.exit(1);
  }
}

restoreAll();
