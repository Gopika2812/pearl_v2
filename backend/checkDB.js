import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = 'mongodb+srv://gopikap2812_db_user:2AbCEcjSxgvum1zW@pearl.ujaby1i.mongodb.net/pearls_erp?retryWrites=true&w=majority';

async function checkReceipts() {
    try {
        await mongoose.connect(MONGO_URI);
        const Receipt = mongoose.connection.db.collection('receipts');
        const receipts = await Receipt.find({}).sort({createdAt: -1}).limit(5).toArray();
        console.log("LAST 5 RECEIPTS:");
        console.log(JSON.stringify(receipts, null, 2));
        
        const countAll = await Receipt.countDocuments({});
        console.log("Total Receipts:", countAll);
        
        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

checkReceipts();
