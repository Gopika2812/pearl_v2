import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product.js';
import PhysicalStockEntry from '../models/PhysicalStockEntry.js';

dotenv.config({ path: '../.env' });

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const product = await Product.findOne({ name: "Choco Filling Dark" });
    if (product) {
        console.log('Product:', product.name);
        const psvs = await PhysicalStockEntry.find({ productId: product._id }).sort({ entryDate: 1 });
        console.log('PSVs:', psvs.map(p => ({
            id: p._id,
            date: p.entryDate, 
            sys: p.systemQty, 
            phys: p.physicalQty, 
            in: p.inwardQty, 
            out: p.outwardQty, 
            status: p.status
        })));
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
