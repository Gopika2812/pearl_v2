import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = "mongodb+srv://gopikap2812_db_user:3EprufLKuDVKIdo3@branchesdb.njfcfju.mongodb.net/pearls_erp?retryWrites=true&w=majority";

async function checkFollowUps() {
    try {
        await mongoose.connect(MONGO_URI);
        const FollowUp = mongoose.model('FollowUp', new mongoose.Schema({ 
            branchId: mongoose.Schema.Types.ObjectId,
            customerId: mongoose.Schema.Types.ObjectId,
            createdAt: Date,
            result: String
        }));
        
        // Check records from last 24 hours
        const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const records = await FollowUp.find({ createdAt: { $gte: last24h } });
        
        console.log(`Found ${records.length} records in last 24h`);
        if (records.length > 0) {
            console.log("Samples:", JSON.stringify(records.slice(0, 5), null, 2));
        }

        // Check if there are ANY records at all
        const allCount = await FollowUp.countDocuments();
        console.log(`Total records in DB: ${allCount}`);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkFollowUps();
