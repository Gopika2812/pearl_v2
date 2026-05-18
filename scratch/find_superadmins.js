import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SuperAdmin from '../backend/models/SuperAdmin.js';

dotenv.config({ path: './backend/.env' });

async function run() {
  try {
    const uri = process.env.MONGO_URI;
    await mongoose.connect(uri);
    const admins = await SuperAdmin.find().lean();
    console.log("SuperAdmins in DB:");
    admins.forEach(a => {
      console.log(`- Username: ${a.username}, Name: ${a.fullName}, Status: ${a.status}`);
    });
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}
run();
