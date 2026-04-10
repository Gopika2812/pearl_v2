
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SalesOrder from './backend/models/SalesOrder.js';

dotenv.config({ path: './backend/.env' });

async function checkRecord() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to DB");

        const id = "69d8c8ec5e76eb237081b062";
        const order = await SalesOrder.findById(id).lean();

        if (order) {
            console.log("Record Found:");
            console.log(JSON.stringify({
                _id: order._id,
                invoiceId: order.invoiceId,
                status: order.status,
                branchId: order.branchId,
                isClaim: order.isClaim,
                orderDate: order.orderDate,
                createdAt: order.createdAt
            }, null, 2));
        } else {
            console.log("Record NOT found by ID: " + id);
            // Try searching by invoiceId
            const order2 = await SalesOrder.findOne({ invoiceId: "GESO/141/26-27" }).lean();
            if (order2) {
                console.log("Found by invoiceId instead:");
                console.log(JSON.stringify({
                    _id: order2._id,
                    invoiceId: order2.invoiceId,
                    status: order2.status,
                    branchId: order2.branchId,
                    isClaim: order2.isClaim,
                    orderDate: order2.orderDate,
                    createdAt: order2.createdAt
                }, null, 2));
            } else {
                console.log("Record NOT found by invoiceId either.");
            }
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

checkRecord();
