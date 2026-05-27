import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  console.log('Connected to MongoDB. Scanning customers...');
  
  // Use raw collection to find documents with linkedVendorId: ""
  const Customer = mongoose.model('Customer', new mongoose.Schema({}, { strict: false }), 'customers');
  
  // Find all customers with empty string or string 'null'
  const customersWithEmptyString = await Customer.find({
    $or: [
      { linkedVendorId: "" },
      { linkedVendorId: "null" }
    ]
  }).lean();
  
  console.log(`Found ${customersWithEmptyString.length} customers with empty string linkedVendorId.`);
  
  if (customersWithEmptyString.length > 0) {
    const res = await Customer.updateMany(
      {
        $or: [
          { linkedVendorId: "" },
          { linkedVendorId: "null" }
        ]
      },
      {
        $set: { linkedVendorId: null }
      }
    );
    console.log('Update result:', res);
  }
  
  mongoose.disconnect();
}).catch(err => {
  console.error('Error:', err);
});
