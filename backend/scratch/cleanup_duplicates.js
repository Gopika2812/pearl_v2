import mongoose from 'mongoose';
import dotenv from 'dotenv';
import PhysicalStockEntry from '../models/PhysicalStockEntry.js';

dotenv.config({ path: '../.env' });

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("Starting cleanup of duplicate Physical Stock Entries...");
    
    // Find all entries on June 30th
    const startJune30 = new Date('2026-06-29T18:30:00Z');
    const endJune30 = new Date('2026-06-30T18:29:59Z');
    
    // Find all entries on July 1st
    const startJuly1 = new Date('2026-06-30T18:30:00Z');
    const endJuly1 = new Date('2026-07-01T18:29:59Z');

    const june30Entries = await PhysicalStockEntry.find({ entryDate: { $gte: startJune30, $lte: endJune30 } });
    const july1Entries = await PhysicalStockEntry.find({ entryDate: { $gte: startJuly1, $lte: endJuly1 } });
    
    const july1ProductIds = new Set(july1Entries.map(e => e.productId.toString()));
    
    let deletedCount = 0;
    
    for (const entry of june30Entries) {
        if (july1ProductIds.has(entry.productId.toString())) {
            // Delete the June 30 entry since a July 1st entry exists for the same product
            await PhysicalStockEntry.findByIdAndDelete(entry._id);
            deletedCount++;
        }
    }
    
    console.log(`Successfully deleted ${deletedCount} duplicate entries from June 30.`);
    console.log(`The July 1st entries have been preserved as the single source of truth.`);
    
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
