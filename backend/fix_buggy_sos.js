import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SalesOrder from './models/SalesOrder.js';
import Product from './models/Product.js';
dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
    // Find all SalesOrders that are invoiced but have empty invoiceItems and non-empty items
    // Actually, just find ALL invoiced sales orders and sync their items to match invoiceItems.
    // Wait, is it safe to overwrite items with invoiceItems? Yes, if it's invoiced, invoiceItems is the official truth.
    // Let's specifically target the buggy one first to see.
    const buggySO = await SalesOrder.find({
        invoiceGenerated: true,
        $expr: { $ne: [{ $size: { $ifNull: ["$invoiceItems", []] } }, { $size: { $ifNull: ["$items", []] } }] }
    }).lean();

    console.log(`Found ${buggySO.length} buggy Sales Orders where items length != invoiceItems length`);

    for (let so of buggySO) {
        console.log(`Fixing SO: ${so.invoiceId} (Items: ${so.items?.length || 0}, InvoiceItems: ${so.invoiceItems?.length || 0})`);
        await SalesOrder.findByIdAndUpdate(so._id, { items: so.invoiceItems || [] });
    }

    console.log('Done fixing buggy Sales Orders');
    process.exit(0);
});
