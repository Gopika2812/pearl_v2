
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SalesOrder from './backend/models/SalesOrder.js';

dotenv.config({ path: './backend/.env' });

async function checkRecent() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const recent = await SalesOrder.find().sort({ createdAt: -1 }).limit(5).lean();
        console.log("Recent Records:");
        recent.forEach(r => {
            console.log(`- ID: ${r._id}, InvoiceId: ${r.invoiceId}, Branch: ${r.branchId}, Status: ${r.status}, CreatedAt: ${r.createdAt}`);
        });
        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

checkRecent();
