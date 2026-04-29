import mongoose from 'mongoose';
import SalesOrder from '../models/SalesOrder.js';

async function testQuery() {
    try {
        await mongoose.connect('mongodb+srv://gopikap2812_db_user:3EprufLKuDVKIdo3@branchesdb.njfcfju.mongodb.net/pearls_erp?retryWrites=true&w=majority');
        
        const branchId = '69cbae49bc6c37f37b325547';
        const fromDate = '2026-04-01';
        const toDate = '2026-04-29';
        
        const query = {
            branchId: branchId,
            isClaim: true
        };
        
        const start = new Date(fromDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        
        query.orderDate = { $gte: start, $lte: end };
        
        console.log("Query:", JSON.stringify(query, null, 2));
        
        const results = await SalesOrder.find(query);
        console.log("Results count:", results.length);
        if (results.length > 0) {
            console.log("First result Invoice ID:", results[0].invoiceId);
        }
        
        await mongoose.disconnect();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
testQuery();
