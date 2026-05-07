import mongoose from 'mongoose';
import Product from './backend/models/Product.js';
import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

async function findProducts() {
    try {
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
