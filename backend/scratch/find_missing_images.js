import mongoose from 'mongoose';
import Product from '../models/Product.js';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function findProducts() {
    try {
        if (!process.env.MONGO_URI) {
            console.error("MONGO_URI not found in .env");
            process.exit(1);
        }
        await mongoose.connect(process.env.MONGO_URI);
        const products = await Product.find({ 
            $or: [
                { image: { $exists: false } },
                { image: "" },
                { image: null }
            ]
        }).limit(20);
        
        console.log(JSON.stringify(products.map(p => ({id: p._id, name: p.name})), null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

findProducts();
