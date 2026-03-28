import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = 'mongodb+srv://gopikap2812_db_user:2AbCEcjSxgvum1zW@pearl.ujaby1i.mongodb.net/pearls_erp?retryWrites=true&w=majority';

async function checkData() {
    try {
        await mongoose.connect(MONGO_URI);
        const Receipt = mongoose.connection.db.collection('receipts');
        const SalesOrder = mongoose.connection.db.collection('salesorders');
        
        const receipts = await Receipt.find({}).toArray();
        const orders = await SalesOrder.find({}).toArray();
        
        console.log("=== TOTAL RECEIPTS IN DB ===");
        console.log(receipts.length);
        console.log("LAST 5 RECEIPTS (SUMMARY):", receipts.slice(-5).map(r => ({id: r.receiptId, branch: r.branchId})));
        
        console.log("\n=== TOTAL SALES ORDERS IN DB ===");
        console.log(orders.length);
        console.log("LAST 5 ORDERS (SUMMARY):", orders.slice(-5).map(o => ({id: o.invoiceId, branch: o.branchId, generated: o.invoiceGenerated})));
        
        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

checkData();
