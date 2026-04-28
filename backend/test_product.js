import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './models/Product.js';
import SalesOrder from './models/SalesOrder.js';
import DebitNote from './models/DebitNote.js';
import PurchaseOrder from './models/PurchaseOrder.js';
import moment from 'moment-timezone';
dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const products = await Product.find({}).lean();
    const p = products.find(prod => prod._id.toString().endsWith('a620a8'));
    
    if (!p) {
        console.log('Product not found');
        process.exit(0);
    }
    
    console.log('Product:', p.name, 'ID:', p._id.toString());
    const pid = p._id;
    const branchOid = p.branchId;

    const HARD_ANCHOR_DATE = moment.tz('2026-03-31 23:59:59', 'Asia/Kolkata').toDate();

    const sales = await SalesOrder.aggregate([
        { $match: { branchId: branchOid, invoiceGenerated: true, status: { $ne: 'CANCELLED' }, orderDate: { $gt: HARD_ANCHOR_DATE } } },
        { $addFields: { effectiveItems: { $cond: [ { $gt: [ { $size: { $ifNull: ['$invoiceItems', []] } }, 0 ] }, '$invoiceItems', '$items' ] } } },
        { $unwind: '$effectiveItems' },
        { $match: { 'effectiveItems.productId': pid } },
        { $group: { _id: null, total: { $sum: '$effectiveItems.qty' } } }
    ]);
    console.log('Sales Outward:', sales);

    const dns = await DebitNote.aggregate([
        { $match: { branchId: branchOid, status: 'Created', date: { $gt: HARD_ANCHOR_DATE } } },
        { $unwind: '$items' },
        { $match: { 'items.productId': pid } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$items.qty', '$items.returnedQty', 0] } } } }
    ]);
    console.log('Debit Notes Outward:', dns);

    const pos = await PurchaseOrder.aggregate([
        { $match: { branchId: branchOid, status: { $in: ['RECEIVED', 'PARTIALLY_RETURNED', 'FULLY_RETURNED', 'INVOICED'] }, date: { $gt: HARD_ANCHOR_DATE } } },
        { $unwind: '$items' },
        { $match: { 'items.productId': pid } },
        { $group: { _id: null, total: { $sum: '$items.qty' } } }
    ]);
    console.log('Purchases Inward:', pos);

    process.exit(0);
});
