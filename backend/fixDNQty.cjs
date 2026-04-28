const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://gopikap2812_db_user:3EprufLKuDVKIdo3@branchesdb.njfcfju.mongodb.net/pearls_erp?retryWrites=true&w=majority').then(async () => { 
  const DN = mongoose.model('DebitNote', new mongoose.Schema({}, {strict: false}), 'debitnotes'); 
  const notes = await DN.find({ 'items.qty': { "$exists": false } }); 
  console.log('Fixing', notes.length, 'notes'); 
  for (const note of notes) { 
    const updatedItems = note.items.map(item => { 
      if (item.qty === undefined || item.qty === null || item.qty === 0) { 
        const price = item.purchasePrice || 0; 
        const taxable = item.taxableAmount || 0; 
        const disc = item.discountPercent || 0; 
        let qty = 0; 
        if (price > 0) { 
          qty = Math.round(taxable / (price * (1 - disc/100))); 
        } 
        item.qty = qty || 1; 
      } 
      return item; 
    }); 
    await DN.findByIdAndUpdate(note._id, { items: updatedItems }); 
  } 
  console.log('Done'); 
  process.exit(0); 
});
