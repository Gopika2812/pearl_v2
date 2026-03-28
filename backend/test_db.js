import mongoose from 'mongoose';

const uri = 'mongodb+srv://gopikap2812_db_user:2AbCEcjSxgvum1zW@pearl.ujaby1i.mongodb.net/pearls_erp?retryWrites=true&w=majority';

mongoose.connect(uri).then(async () => {
  const receipts = mongoose.connection.collection('receipts');
  console.log("Connected. Fetching last few RCP receipts...");
  
  const docs = await receipts.find({ receiptId: { $regex: '^RCP/' } })
    .sort({ receiptId: -1 })
    .limit(10)
    .toArray();
    
  console.dir(docs.map(d => ({
    receiptId: d.receiptId,
    financialYear: d.financialYear,
    createdAt: d.createdAt
  })));
  
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
