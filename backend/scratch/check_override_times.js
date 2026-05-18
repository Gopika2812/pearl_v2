import mongoose from 'mongoose';
import dotenv from 'dotenv';
import OverrideRequest from '../models/OverrideRequest.js';

dotenv.config({ path: './.env' });

async function run() {
  try {
    const uri = process.env.MONGO_URI;
    await mongoose.connect(uri);
    const requests = await OverrideRequest.find().sort({ createdAt: -1 }).limit(10).lean();
    console.log("Recent Override Requests:");
    requests.forEach(r => {
      console.log(`- Customer: ${r.customerId}, Type: ${r.requestType}, Status: ${r.status}`);
      console.log(`  CreatedAt (Request Time): ${r.createdAt}`);
      console.log(`  UpdatedAt (Action Time):  ${r.updatedAt}`);
    });
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}
run();
