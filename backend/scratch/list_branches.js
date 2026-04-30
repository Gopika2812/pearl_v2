import mongoose from 'mongoose';
import Branch from '../models/Branch.js';

async function listBranches() {
    try {
        await mongoose.connect('mongodb+srv://gopikap2812_db_user:3EprufLKuDVKIdo3@branchesdb.njfcfju.mongodb.net/pearls_erp?retryWrites=true&w=majority');
        const branches = await Branch.find({});
        console.log(JSON.stringify(branches.map(b => ({id: b._id, name: b.name}))));
        await mongoose.disconnect();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
listBranches();
