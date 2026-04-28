import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './models/Product.js';
import SalesOrder from './models/SalesOrder.js';
import DebitNote from './models/DebitNote.js';
import PurchaseOrder from './models/PurchaseOrder.js';
import CreditNote from './models/CreditNote.js';
import moment from 'moment-timezone';
dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const p = await Product.findOne({ _id: new mongoose.Types.ObjectId('69cdad1c546a92d67c3fe6a4') }).lean();
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

    const dns = await DebitNote.aggregate([
        { $match: { branchId: branchOid, status: 'Created', date: { $gt: HARD_ANCHOR_DATE } } },
        { $unwind: '$items' },
        { $match: { 'items.productId': pid } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$items.qty', '$items.returnedQty', 0] } } } }
    ]);

    const pos = await PurchaseOrder.aggregate([
        { $match: { branchId: branchOid, status: { $in: ['RECEIVED', 'PARTIALLY_RETURNED', 'FULLY_RETURNED', 'INVOICED'] }, date: { $gt: HARD_ANCHOR_DATE } } },
        { $unwind: '$items' },
        { $match: { 'items.productId': pid } },
        { $group: { _id: null, total: { $sum: '$items.qty' } } }
    ]);

    const cns = await CreditNote.aggregate([
        { $match: { branchId: branchOid, status: { $in: ['Created', 'confirmed'] }, createdAt: { $gt: HARD_ANCHOR_DATE } } },
        { $addFields: { effectiveDate: { $ifNull: ['$date', '$createdAt'] } } },
        { $unwind: '$items' },
        { $match: { 'items.productId': pid } },
        { $group: { _id: null, total: { $sum: '$items.qty' } } }
    ]);

    const s = sales[0]?.total || 0;
    const dn = dns[0]?.total || 0;
    const p_in = pos[0]?.total || 0;
    const cn = cns[0]?.total || 0;

    console.log('Sales:', s);
    console.log('Debit Notes:', dn);
    console.log('Purchases:', p_in);
    console.log('Credit Notes:', cn);

    const calculatedOpening = p.totalQty - (p_in + cn) + (s + dn);
    console.log('Calculated Opening:', calculatedOpening);
    
    process.exit(0);
});
