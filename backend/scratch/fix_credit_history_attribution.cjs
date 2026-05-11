const mongoose = require('mongoose');
require('dotenv').config({path: '.env'});

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const OverrideRequestSchema = new mongoose.Schema({}, { strict: false });
    const OverrideRequest = mongoose.model('OverrideRequest', OverrideRequestSchema, 'overriderequests');
    const BranchUserSchema = new mongoose.Schema({role: String, branch: mongoose.Schema.Types.ObjectId, name: String});
    const BranchUser = mongoose.model('BranchUser', BranchUserSchema, 'branchusers');

    // Find the records I incorrectly tagged as SuperAdmin or those without any approvedBy
    const history = await OverrideRequest.find({ 
        requestType: 'CREDIT_LIMIT', 
        status: { $in: ['APPROVED', 'REJECTED'] },
        $or: [
            { approvedBy: new mongoose.Types.ObjectId("69cb74aa3aad0f4a78d6871f") },
            { approvedBy: { $exists: false } },
            { approvedBy: null }
        ]
    });

    console.log(`Found ${history.length} records to fix.`);

    let updatedToUser = 0;
    let revertedToNull = 0;

    for (const req of history) {
        // Find the first ADMIN user for this specific branch
        const admin = await BranchUser.findOne({ branch: req.branchId, role: 'ADMIN' });
        if (admin) {
            await OverrideRequest.updateOne(
                { _id: req._id },
                { $set: { approvedBy: admin._id, approvedByModel: 'BranchUser' } }
            );
            updatedToUser++;
        } else {
            // Revert to null so it shows as "Admin" in UI (Fallback)
            await OverrideRequest.updateOne(
                { _id: req._id },
                { $set: { approvedBy: null, approvedByModel: 'BranchUser' } }
            );
            revertedToNull++;
        }
    }

    console.log(`Fixed ${updatedToUser} records with actual Branch Admin names.`);
    console.log(`Set ${revertedToNull} records to generic "Admin" display.`);
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
