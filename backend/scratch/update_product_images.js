import mongoose from 'mongoose';
import Product from '../models/Product.js';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

const updates = {
  "TRIKEN CHICKEN MANCHURIAN BALLS 1KG (1*50)": "https://trikenchefs.com/wp-content/uploads/2025/11/mm2-1.webp",
  "Amul Cake Magic Black Forest 500ml (1*18)": "https://cdn.grofers.com/da/cms-assets/cms/product/f09cfba3-d565-49aa-86c6-025d34045e26.png",
  "Amul Happy Treat French Fries 2.5 Kg (6mm)": "https://m.media-amazon.com/images/I/81a5h8Go5PL.jpg",
  "AMUL HAPPY TREATS FRENCH FRIES 9MM": "https://m.media-amazon.com/images/I/81a5h8Go5PL.jpg",
  "Amul Malai Paneer 250GM": "https://m.media-amazon.com/images/I/41aialzUIxL.jpg",
  "Amul Malai Paneer 100gm(1*100)": "https://m.media-amazon.com/images/I/41aialzUIxL.jpg"
};

async function updateProducts() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        
        for (const [name, imageUrl] of Object.entries(updates)) {
            // Escape special chars then handle spaces
            const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const flexibleName = escaped.replace(/\\?\s+/g, '\\s+');
            
            const result = await Product.updateMany(
                { name: { $regex: new RegExp(flexibleName, "i") } },
                { $set: { image: imageUrl } }
            );
            console.log(`Updated ${result.modifiedCount} products matching "${name}"`);
        }
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

updateProducts();
