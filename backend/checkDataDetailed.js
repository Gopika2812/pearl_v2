import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://gopikap2812_db_user:2AbCEcjSxgvum1zW@pearl.ujaby1i.mongodb.net/pearls_erp?retryWrites=true&w=majority';

async function checkData() {
    try {
        await mongoose.connect(MONGO_URI);
        const db = mongoose.connection.db;
        
        const receipts = await db.collection('receipts').find({}).toArray();
        const orders = await db.collection('salesorders').find({}).toArray();
        const invoices = await db.collection('invoices').find({}).toArray();
        
        console.log("=== STATS ===");
        console.log("Receipts:", receipts.length);
        console.log("Orders:", orders.length);
        console.log("Invoices:", invoices.length);
        
        if (orders.length > 0) {
            console.log("\n=== SAMPLE ORDER ===");
            const o = orders[0];
            console.log("ID:", o._id);
            console.log("invoiceId:", o.invoiceId);
            console.log("invoiceGenerated:", o.invoiceGenerated);
            console.log("branchId:", o.branchId);
            console.log("status:", o.status);
        }

        if (receipts.length > 0) {
            console.log("\n=== SAMPLE RECEIPT ===");
            const r = receipts[receipts.length - 1]; // newest
            console.log("ID:", r._id);
            console.log("receiptId:", r.receiptId);
            console.log("branchId:", r.branchId);
            console.log("originalSalesOrderId:", r.originalSalesOrderId);
        }

        if (invoices.length > 0) {
            console.log("\n=== SAMPLE INVOICE ===");
            const i = invoices[0];
            console.log("ID:", i._id);
            console.log("invoiceNumber:", i.invoiceNumber);
            console.log("branchId:", i.branchId);
            console.log("salesOrderId:", i.salesOrderId);
        }

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkData();
