const mongoose = require('mongoose');

async function main() {
  try {
    const uri = 'mongodb+srv://gopikap2812_db_user:3EprufLKuDVKIdo3@branchesdb.njfcfju.mongodb.net/pearls_erp?retryWrites=true&w=majority';
    await mongoose.connect(uri);
    console.log('Connected to MongoDB Atlas!');
    
    const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));
    const products = await Product.find({}).lean();
    console.log(`Found ${products.length} products`);
    
    const types = {};
    const missing = [];
    const nonNumbers = [];
    
    products.forEach(p => {
      const val = p.totalQty;
      const type = typeof val;
      types[type] = (types[type] || 0) + 1;
      
      if (val === undefined || val === null) {
        missing.push(p.name);
      } else if (type !== 'number') {
        nonNumbers.push({ name: p.name, val, type });
      }
    });
    
    console.log('Type breakdown:', types);
    console.log('Missing count:', missing.length);
    console.log('Non-number examples (first 10):', nonNumbers.slice(0, 10));
    
    // Check specific product: "Amul Strawberry 4lit"
    const amul = products.find(p => p.name && p.name.includes('Amul Strawberry 4lit'));
    if (amul) {
      console.log('Found Amul Strawberry 4lit:', {
        name: amul.name,
        totalQty: amul.totalQty,
        totalQtyType: typeof amul.totalQty
      });
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

main();
