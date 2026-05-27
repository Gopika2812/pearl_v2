import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Customer from './models/Customer.js';

dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  console.log('Connected to MongoDB.');
  
  try {
    // Let's retrieve all customer documents using lean and see if we can find any empty strings
    console.log('Retrieving all customers as lean javascript objects...');
    const rawCustomers = await mongoose.connection.db.collection('customers').find({}).toArray();
    console.log(`Found ${rawCustomers.length} raw customer documents.`);
    
    let count = 0;
    for (const doc of rawCustomers) {
      if (doc.linkedVendorId === "" || doc.linkedVendorId === "null" || doc.linkedVendorId === "undefined") {
        console.log(`Customer "${doc.name}" (${doc._id}) has invalid linkedVendorId:`, JSON.stringify(doc.linkedVendorId));
        count++;
        // Fix it directly in the db collection
        await mongoose.connection.db.collection('customers').updateOne(
          { _id: doc._id },
          { $set: { linkedVendorId: null } }
        );
        console.log(`-> Fixed to null for "${doc.name}"`);
      }
    }
    console.log(`Scan complete. Fixed ${count} invalid records.`);
    
    // Test if Mongoose find works now
    console.log('Testing Mongoose find with linkedVendorId query...');
    const testCustomers = await Customer.find({
      linkedVendorId: { $ne: null }
    }).select('linkedVendorId').lean();
    console.log(`Success! Found ${testCustomers.length} linked customers via Mongoose.`);
  } catch (err) {
    console.error('Error during customer scan:', err);
  }
  
  mongoose.disconnect();
}).catch(err => {
  console.error('Error:', err);
});
