import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function fixMargin() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB...");

    // Define temporary schemas to avoid model collisions
    const Product = mongoose.models.Product || mongoose.model('Product', new mongoose.Schema({ name: String, purchasingPrice: Number }));
    const CustomerLockedPrice = mongoose.models.CustomerLockedPrice || mongoose.model('CustomerLockedPrice', new mongoose.Schema({ 
      productId: mongoose.Schema.Types.ObjectId, 
      lockedPrice: Number, 
      purchasingPrice: Number, 
      margin: Number, 
      marginPercentage: Number 
    }));

    const product = await Product.findOne({ name: /VLF CHICKEN BBQ MOMOS/i });
    if (!product) {
      console.log("❌ Product not found");
      return;
    }

    const cost = product.purchasingPrice || 105;
    const targetMarginPct = 20;
    const newLockedPrice = Math.round((cost + (cost * targetMarginPct / 100)) * 100) / 100;

    const result = await CustomerLockedPrice.updateOne(
      { productId: product._id }, 
      { 
        $set: { 
          marginPercentage: targetMarginPct, 
          lockedPrice: newLockedPrice, 
          margin: Math.round((newLockedPrice - cost) * 100) / 100, 
          purchasingPrice: cost 
        } 
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`✅ Successfully fixed VLF record to 20% margin.`);
      console.log(`📊 Cost: ₹${cost} | New Locked Price: ₹${newLockedPrice} (Exactly 20% profit)`);
    } else {
      console.log("⚠️ Record was already correct or not found.");
    }

  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    await mongoose.connection.close();
  }
}

fixMargin();
