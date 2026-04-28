const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://gopikap2812_db_user:3EprufLKuDVKIdo3@branchesdb.njfcfju.mongodb.net/pearls_erp?retryWrites=true&w=majority').then(async () => { 
  const DN = mongoose.model('DebitNote', new mongoose.Schema({}, {strict: false}), 'debitnotes'); 
  const Product = mongoose.model('Product', new mongoose.Schema({ hsn: String }), 'products');
  
  const notes = await DN.find({}); 
  console.log('Fixing HSN and Tax for', notes.length, 'notes'); 
  
  for (const note of notes) { 
    const updatedItems = await Promise.all(note.items.map(async item => { 
      // Fix HSN
      if (!item.hsn && item.productId) {
        const p = await Product.findById(item.productId);
        if (p) item.hsn = p.hsn;
      }
      
      // Fix Tax Breakdown
      const taxable = item.taxableAmount || 0;
      const total = item.total || 0;
      const itemTax = total - taxable;
      
      if (itemTax > 0 && (item.cgst === undefined || item.cgst === 0)) {
        item.cgst = itemTax / 2;
        item.sgst = itemTax / 2;
        item.igst = 0;
      }
      
      return item; 
    })); 
    
    await DN.findByIdAndUpdate(note._id, { items: updatedItems }); 
  } 
  console.log('Done'); 
  process.exit(0); 
});
