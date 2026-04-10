
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: './backend/.env' });

async function checkBranches() {
    try {
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        await mongoose.connect(uri);
        const Branch = mongoose.connection.collection('branches');
        const branches = await Branch.find().toArray();
        console.log("Branches in DB:");
        branches.forEach(b => {
             console.log(`- Name: ${b.name}, ID: ${b._id}`);
        });
        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

checkBranches();
