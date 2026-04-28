import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SalesOrder from './models/SalesOrder.js';
dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
    // We want to fix ALL invoiced sales orders where `invoiceItems` does not match the actual truth.
    // The absolute truth for an invoiced order is `lastInvoicedItems`.
    // We will set `items` = `lastInvoicedItems` and `invoiceItems` = `lastInvoicedItems`.
    
    const invoicedOrders = await SalesOrder.find({ invoiceGenerated: true }).lean();
    console.log(`Found ${invoicedOrders.length} invoiced orders.`);

    let fixedCount = 0;
    for (let so of invoicedOrders) {
        let truthItems = so.lastInvoicedItems;
        
        if (!truthItems || truthItems.length === 0) {
            // Fallback to editHistory
            if (so.editHistory && so.editHistory.length > 0) {
                // Find the latest history that has items
                const validHistory = [...so.editHistory].reverse().find(h => h.items && h.items.length > 0);
                if (validHistory) {
                    truthItems = validHistory.items;
                }
            }
        }
        
        // If we still don't have truthItems, use items if it has them
        if (!truthItems || truthItems.length === 0) {
            truthItems = so.items;
        }

        // If even items is empty, there is nothing we can do, it's genuinely empty
        if (!truthItems) truthItems = [];

        // Check if we need to update
        const needUpdate = 
            (so.items?.length !== truthItems.length) || 
            (so.invoiceItems?.length !== truthItems.length);

        if (needUpdate || so.invoiceItems === undefined) {
            await SalesOrder.findByIdAndUpdate(so._id, { 
                items: truthItems, 
                invoiceItems: truthItems,
                lastInvoicedItems: truthItems
            });
            fixedCount++;
        }
    }

    console.log(`Successfully fixed ${fixedCount} Sales Orders to use lastInvoicedItems as the absolute truth.`);
    process.exit(0);
});
