import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SalesOrder from '../models/SalesOrder.js';
import Invoice from '../models/Invoice.js';
import Token from '../models/Token.js';
import FollowUp from '../models/FollowUp.js';
import BranchUser from '../models/BranchUser.js';

dotenv.config({ path: './backend/.env' });

async function checkData() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const branchId = "678e0797177579ce32488d5e"; // I'll try to find a branch id if possible, but let's just check all counts first.
        
        console.log("--- Global Counts ---");
        console.log("SalesOrders:", await SalesOrder.countDocuments());
        console.log("Invoices:", await Invoice.countDocuments());
        console.log("Tokens:", await Token.countDocuments());
        console.log("FollowUps:", await FollowUp.countDocuments());

        const sampleUser = await BranchUser.findOne({ username: 'superadmin' });
        console.log("--- Superadmin Info ---");
        console.log(sampleUser);

        const sampleSO = await SalesOrder.findOne().sort({ createdAt: -1 });
        console.log("--- Latest Sales Order ---");
        console.log(JSON.stringify(sampleSO, null, 2));

        const sampleInv = await Invoice.findOne().sort({ createdAt: -1 });
        console.log("--- Latest Invoice ---");
        console.log(JSON.stringify(sampleInv, null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkData();
