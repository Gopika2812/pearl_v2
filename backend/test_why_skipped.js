import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './models/Product.js';
import PurchaseOrder from "./models/PurchaseOrder.js";
import SalesOrder from "./models/SalesOrder.js";
import DebitNote from "./models/DebitNote.js";
import CreditNote from "./models/CreditNote.js";

dotenv.config();

const HARD_ANCHOR_DATE = new Date("2026-03-31T23:59:59Z");

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const products = await Product.find({totalQty: {$gt: 0}, openingQty: 0}).lean();
    console.log('Mismatched products count:', products.length);
    
    if (products.length > 0) {
        let sample = products[0];
        const pid = sample._id;

        const [purchases, sales, debitNotes, creditNotes] = await Promise.all([
        PurchaseOrder.aggregate([
            { $match: { "items.productId": pid, status: { $in: ["RECEIVED", "PARTIALLY_RETURNED", "INVOICED"] }, date: { $gt: HARD_ANCHOR_DATE } } },
            { $unwind: "$items" },
            { $match: { "items.productId": pid } },
            { $group: { _id: null, total: { $sum: "$items.qty" } } }
        ]),
        SalesOrder.aggregate([
            { $match: { invoiceGenerated: true, orderDate: { $gt: HARD_ANCHOR_DATE }, "invoiceItems.productId": pid } },
            { $unwind: "$invoiceItems" },
            { $match: { "invoiceItems.productId": pid } },
            { $group: { _id: null, total: { $sum: "$invoiceItems.qty" } } }
        ]),
        DebitNote.aggregate([
            { $match: { status: "Created", date: { $gt: HARD_ANCHOR_DATE }, "items.productId": pid } },
            { $unwind: "$items" },
            { $match: { "items.productId": pid } },
            { $group: { _id: null, total: { $sum: { $ifNull: ["$items.qty", "$items.returnedQty", 0] } } } }
        ]),
        CreditNote.aggregate([
            { $match: { status: { $in: ["Created", "confirmed"] }, createdAt: { $gt: HARD_ANCHOR_DATE }, "items.productId": pid } },
            { $unwind: "$items" },
            { $match: { "items.productId": pid } },
            { $group: { _id: null, total: { $sum: "$items.qty" } } }
        ])
        ]);

        const tIn = (purchases[0]?.total || 0) + (creditNotes[0]?.total || 0);
        const tOut = (sales[0]?.total || 0) + (debitNotes[0]?.total || 0);
        const currentAvailable = (sample.openingQty || 0) + tIn - tOut;

        console.log('Sample:', sample.name);
        console.log('TotalQty:', sample.totalQty);
        console.log('OpeningQty:', sample.openingQty);
        console.log('tIn:', tIn);
        console.log('tOut:', tOut);
        console.log('currentAvailable:', currentAvailable);
    }
    process.exit(0);
});
