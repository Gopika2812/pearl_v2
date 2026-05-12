const mongoose = require('mongoose');
require('dotenv').config({path: '.env'});

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const adminId = '69cb74aa3aad0f4a78d6871f';
    const OverrideRequestSchema = new mongoose.Schema({}, { strict: false });
    const OverrideRequest = mongoose.model('OverrideRequest', OverrideRequestSchema, 'overriderequests');

    const result = await OverrideRequest.updateMany(
        { 
            requestType: 'CREDIT_LIMIT', 
            status: { $in: ['APPROVED', 'REJECTED'] },
            $or: [
                { approvedBy: { $exists: false } },
                { approvedBy: null }
            ]
        },
        { 
            $set: { 
                approvedBy: new mongoose.Types.ObjectId(adminId),
                approvedByModel: 'SuperAdmin'
            } 
        }
    );

    console.log(`Updated ${result.modifiedCount} records.`);
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
