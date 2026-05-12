import mongoose from 'mongoose';
import dotenv from 'dotenv';
import CRMTask from '../modules/crm-orders/models/CRMTask.js';

dotenv.config({ path: './backend/.env' });

async function checkTasks() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const count = await CRMTask.countDocuments();
        console.log("CRMTask Count:", count);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkTasks();
