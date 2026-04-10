
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Invoice from './backend/models/Invoice.js';

dotenv.config({ path: './backend/.env' });

async function countInvoices() {
    try {
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        await mongoose.connect(uri);
        const total = await Invoice.countDocuments();
        console.log(`Total Invoices in DB: ${total}`);
        
        const branchId = "69cbae49bc6c37f37b325547";
        const branchInvoices = await Invoice.countDocuments({ branchId: new mongoose.Types.ObjectId(branchId) });
        console.log(`Invoices for Branch ${branchId}: ${branchInvoices}`);

        const target = await Invoice.findOne({ invoiceNumber: /141/ }).lean();
        if (target) {
            console.log("\nFound Target Invoice!");
            console.log(`- InvoiceNumber: ${target.invoiceNumber}, Branch: ${target.branchId}, Date: ${target.invoiceDate}`);
        } else {
             console.log("\nTarget Invoice (141) NOT found in Invoice collection.");
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

countInvoices();
