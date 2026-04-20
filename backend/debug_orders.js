import mongoose from 'mongoose';
const uri = 'mongodb+srv://gopikap2812_db_user:3EprufLKuDVKIdo3@branchesdb.njfcfju.mongodb.net/pearls_erp?retryWrites=true&w=majority';

async function debug() {
  try {
    await mongoose.connect(uri);
    const SalesOrder = mongoose.model('SalesOrder', new mongoose.Schema({}, { strict: false }), 'salesorders');
    
    // Test 1: By orderDate (Today)
    const start = new Date('2026-04-18');
    start.setHours(0,0,0,0);
    const end = new Date('2026-04-18');
    end.setHours(23,59,59,999);

    const query = { 
      branchId: new mongoose.Types.ObjectId('69cbae49bc6c37f37b325547'), 
      orderDate: { $gte: start, $lte: end } 
    };
    
    const orders = await SalesOrder.find(query).select('invoiceId status createdAt orderDate').sort({ createdAt: -1 });
    console.log('--- Orders found for Today in branch 5547 ---');
    console.log('Count:', orders.length);
    orders.forEach(o => console.log(`${o.invoiceId} | ${o.status} | CreatedAt: ${o.createdAt.toISOString()} | OrderDate: ${o.orderDate.toISOString()}`));

    // Test 2: Specific order lookup
    const target = await SalesOrder.findOne({ invoiceId: 'GESO/309/26-27' });
    if (target) {
        console.log('\n--- Specific Order 309 Details ---');
        console.log('ID:', target._id);
        console.log('BranchID:', target.branchId);
        console.log('Status:', target.status);
        console.log('OrderDate:', target.orderDate);
        console.log('CreatedAt:', target.createdAt);
    } else {
        console.log('\nOrder GESO/309/26-27 NOT FOUND in DB');
    }

  } catch(e) {
    console.error(e);
  } finally {
    await mongoose.disconnect();
  }
}

debug();
