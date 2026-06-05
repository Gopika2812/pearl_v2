import mongoose from 'mongoose';
import Branch from '../models/Branch.js';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/pearl_v2")
  .then(async () => {
    // Set geocoding replacements for Tirunelveli branches
    const res = await Branch.updateMany(
      { location: /Tirunelveli/i },
      { $set: { locationReplacements: { "Padappakurichi": "Palayamkottai" } } }
    );
    console.log("Updated branches count:", res.modifiedCount);
    
    // Print updated branches
    const branches = await Branch.find({ location: /Tirunelveli/i });
    console.log(JSON.stringify(branches, null, 2));
    
    process.exit(0);
  });
