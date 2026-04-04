import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Invoice from './backend/models/Invoice.js';
dotenv.config();

async function checkInvoices() {
    await mongoose.connect(process.env.MONGODB_URI);
    const invoices = await Invoice.find({ einvoiceStatus: 'GENERATED' }).sort({ createdAt: -1 }).limit(5);

    invoices.forEach(inv => {
        console.log(`Invoice: ${inv.invoiceNumber}`);
        console.log(`IRN: ${inv.irn ? 'YES' : 'NO'}`);
        console.log(`qrCodeUrl: ${inv.qrCodeUrl || 'EMPTY'}`);
        console.log(`signedQrCode: ${inv.signedQrCode ? 'YES (Length: ' + inv.signedQrCode.length + ')' : 'EMPTY'}`);
        console.log('---');
    });
    process.exit(0);
}
checkInvoices();
