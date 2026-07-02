import mongoose from 'mongoose';
import dotenv from 'dotenv';
import PhysicalStockEntry from '../models/PhysicalStockEntry.js';
import Product from '../models/Product.js';

dotenv.config({ path: '../.env' });

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("Checking if duplicate physical quantities match...");
    
    const startJune30 = new Date('2026-06-29T18:30:00Z');
    const endJune30 = new Date('2026-06-30T18:29:59Z');
    
    const startJuly1 = new Date('2026-06-30T18:30:00Z');
    const endJuly1 = new Date('2026-07-01T18:29:59Z');

    const june30Entries = await PhysicalStockEntry.find({ entryDate: { $gte: startJune30, $lte: endJune30 } }).lean();
    const july1Entries = await PhysicalStockEntry.find({ entryDate: { $gte: startJuly1, $lte: endJuly1 } }).lean();
    
    const july1Map = new Map();
    for (const entry of july1Entries) {
        july1Map.set(entry.productId.toString(), entry);
    }
    
    let exactMatches = 0;
    let mismatches = 0;
    
    for (const juneEntry of june30Entries) {
        const julyEntry = july1Map.get(juneEntry.productId.toString());
        if (julyEntry) {
            if (juneEntry.physicalQty === julyEntry.physicalQty) {
                exactMatches++;
            } else {
                mismatches++;
            }
        }
    }
    
    console.log(`Exact matches (same physical count on both dates): ${exactMatches}`);
    console.log(`Mismatches (different physical counts): ${mismatches}`);
    
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
