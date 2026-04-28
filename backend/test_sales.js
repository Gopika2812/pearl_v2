import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SalesOrder from './models/SalesOrder.js';
import Product from './models/Product.js';
dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const p = await Product.findOne({ _id: new mongoose.Types.ObjectId('69cf19814293f3c7e0a620a8') }).lean();
    const pid = p._id;
    
    const sales = await SalesOrder.find({
        $or: [
            {'items.productId': pid},
            {'invoiceItems.productId': pid}
        ]
    }).lean();

    sales.forEach(s => {
        console.log('InvoiceID:', s.invoiceId);
        console.log('Status:', s.status);
        console.log('InvoiceGenerated:', s.invoiceGenerated);
        console.log('Items Count:', s.items ? s.items.length : 0);
        const itemMatch = s.items?.find(i => i.productId.toString() === pid.toString());
        console.log('Item Match:', itemMatch ? itemMatch.qty : 'None');
        const invItemMatch = s.invoiceItems?.find(i => i.productId.toString() === pid.toString());
        console.log('InvoiceItem Match:', invItemMatch ? invItemMatch.qty : 'None');
    });

    process.exit(0);
});
