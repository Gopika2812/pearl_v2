
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SalesOrder from './backend/models/SalesOrder.js';

dotenv.config({ path: './backend/.env' });

async function checkRecent() {
    try {
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        if (!uri) {
            console.error("MONGO_URI not found in .env");
            process.exit(1);
        }
        await mongoose.connect(uri);
        const recent = await SalesOrder.find().sort({ createdAt: -1 }).limit(10).lean();
        console.log("Recent Records:");
        recent.forEach(r => {
            console.log(`- ID: ${r._id}, InvoiceId: ${r.invoiceId}, SI: ${r.salesInvoiceId}, Branch: ${r.branchId}, Status: ${r.status}, CreatedAt: ${r.createdAt}`);
        });

        const idToSearch = "69d8c8ec5e76eb237081b062";
        const order = await SalesOrder.findById(idToSearch).lean();
        if (order) {
            console.log("\nFound Target Record by ID!");
            console.log(`- Status: ${order.status}, Branch: ${order.branchId}, isClaim: ${order.isClaim}, orderDate: ${order.orderDate}`);
        } else {
            const byInvId = await SalesOrder.findOne({ invoiceId: "GESO/141/26-27" }).lean();
             if (byInvId) {
                console.log("\nFound Target Record by InvoiceId!");
                console.log(`- ID: ${byInvId._id}, Status: ${byInvId.status}, Branch: ${byInvId.branchId}, isClaim: ${byInvId.isClaim}, orderDate: ${byInvId.orderDate}`);
            } else {
                console.log("\nTarget Record NOT found by ID or InvoiceId.");
            }
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

checkRecent();
