import mongoose from 'mongoose';
import SalesOrder from '../models/SalesOrder.js';

async function updateOrder() {
    try {
        await mongoose.connect('mongodb+srv://gopikap2812_db_user:3EprufLKuDVKIdo3@branchesdb.njfcfju.mongodb.net/pearls_erp?retryWrites=true&w=majority');
        
        const result = await SalesOrder.findOneAndUpdate(
            { invoiceId: 'GESO/142/26-27' },
            { isClaim: false },
            { new: true }
        );
        
        if (result) {
            console.log(`✅ Success! Updated ${result.invoiceId}.`);
            console.log(`Branch Name: GOMATHI ENTERPRISES (Verified)`);
            console.log(`isClaim is now: ${result.isClaim}`);
        } else {
            console.log("❌ Could not find an order with that Invoice ID.");
        }
        
        await mongoose.disconnect();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
updateOrder();
