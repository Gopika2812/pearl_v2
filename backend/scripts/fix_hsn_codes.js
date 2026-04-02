import mongoose from 'mongoose';
import Product from '../models/Product.js';

const uri = 'mongodb+srv://gopikap2812_db_user:2AbCEcjSxgvum1zW@pearl.ujaby1i.mongodb.net/pearls_erp?retryWrites=true&w=majority';

async function fixHsnCodes() {
  try {
    console.log("Connecting to database...");
    await mongoose.connect(uri);
    console.log("Connected successfully.");

    const products = await Product.find({});
    console.log(`Checking ${products.length} products...`);

    let fixedCount = 0;
    let manualFixNeeded = [];

    for (const product of products) {
      const hsn = String(product.hsnCode || "").trim();
      
      // If HSN is 7 digits, it's likely missing a trailing zero or leading zero.
      // E-Invoice requires 4, 6, or 8 digits.
      if (hsn.length !== 4 && hsn.length !== 6 && hsn.length !== 8 && hsn.length > 0) {
        
        let newHsn = hsn;
        
        // Specific fix for the one reported by the user
        if (hsn === '7104000') {
          newHsn = '71049000'; // Common 8-digit HSN for synthetic stones
        } 
        // General heuristic: if 7 digits, add a trailing 0 to make it 8
        else if (hsn.length === 7) {
          newHsn = hsn + '0';
        }
        // General heuristic: if 3 or 5 digits, add a leading 0? (Less common, better to manual fix)
        
        if (newHsn.length === 4 || newHsn.length === 6 || newHsn.length === 8) {
          console.log(`Updating Product "${product.name}": ${hsn} -> ${newHsn}`);
          product.hsnCode = newHsn;
          product.hsn = newHsn; // Update alias too
          await product.save({ validateBeforeSave: false }); // Skip validation if needed, but our new validation allows 8 digits
          fixedCount++;
        } else {
          manualFixNeeded.push({
            id: product._id,
            name: product.name,
            hsn: hsn
          });
        }
      }
    }

    console.log(`\n✅ Data Cleanup Complete!`);
    console.log(`Successfully fixed: ${fixedCount} products.`);
    
    if (manualFixNeeded.length > 0) {
      console.log(`\n⚠️ Products requiring manual fix (${manualFixNeeded.length}):`);
      manualFixNeeded.forEach(p => {
        console.log(`- [${p.hsn}] ${p.name} (ID: ${p.id})`);
      });
    }

    process.exit(0);
  } catch (err) {
    console.error("Error during cleanup:", err);
    process.exit(1);
  }
}

fixHsnCodes();
