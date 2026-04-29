import mongoose from 'mongoose';
import SalesOrder from '../models/SalesOrder.js';

async function checkOrder() {
    try {
        await mongoose.connect('mongodb+srv://gopikap2812_db_user:3EprufLKuDVKIdo3@branchesdb.njfcfju.mongodb.net/pearls_erp?retryWrites=true&w=majority');
        const order = await SalesOrder.findOne({ invoiceId: 'GESO/142/26-27' });
        console.log(JSON.stringify(order, null, 2));
        await mongoose.disconnect();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkOrder();
