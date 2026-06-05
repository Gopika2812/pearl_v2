import mongoose from 'mongoose';
import Branch from '../models/Branch.js';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/pearl_v2")
  .then(async () => {
    const branches = await Branch.find();
    console.log(JSON.stringify(branches, null, 2));
    process.exit(0);
  });
