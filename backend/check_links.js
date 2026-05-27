import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Customer = mongoose.model('Customer', new mongoose.Schema({}, { strict: false }), 'customers');
  const Vendor = mongoose.model('Vendor', new mongoose.Schema({}, { strict: false }), 'vendors');
  
  const branchId = '69cc1d573493c36f8cb7b419'; // the branch from the screenshot
  const branchObjectId = new mongoose.Types.ObjectId(branchId);
  
  // Simulate what the backend does
  const linkedCustomers = await Customer.find({
    branchId: branchObjectId,
    linkedVendorId: { $ne: null }
  }).select('linkedVendorId').lean();
  
  const linkedVendorIds = linkedCustomers.map(c => c.linkedVendorId);
  console.log('Found linked vendor IDs to exclude:', linkedVendorIds.map(id => id.toString()));
  
  const query = { branchId: branchObjectId };
  if (linkedVendorIds.length > 0) {
    query._id = { $nin: linkedVendorIds };
  }
  
  const vendors = await Vendor.find(query).select('name _id').lean();
  console.log('\nVendors that SHOULD show in suppliers page:');
  vendors.forEach(v => console.log(`  ${v.name}`));

  mongoose.disconnect();
}).catch(e => console.error(e));
