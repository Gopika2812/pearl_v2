const mongoose = require('mongoose');

async function fixBalances() {
  try {
    const mongodbUri = 'mongodb+srv://gopikap2812_db_user:3EprufLKuDVKIdo3@branchesdb.njfcfju.mongodb.net/pearls_erp?retryWrites=true&w=majority';
    console.log('🔌 Attempting to connect to MongoDB...');
    await mongoose.connect(mongodbUri);
    console.log('✅ Connected to MongoDB');

    const customerSchema = new mongoose.Schema({ 
        name: String, 
        debit: Number, 
        closingBalance: Number, 
        totalBalance: Number 
    }, { collection: 'customers' });
    
    const Customer = mongoose.model('Customer', customerSchema);

    // 1. Thalaiyuthu
    console.log('Searching for Thalaiyuthu...');
    const c1 = await Customer.findOneAndUpdate(
        { name: /THALAIYUTHU/i }, 
        { $inc: { debit: -15504, closingBalance: -15504, totalBalance: -15504 } }, 
        { new: true }
    );
    if (c1) {
        console.log(`✅ Fixed ${c1.name}: New Debit=${c1.debit}, New Closing=${c1.closingBalance}`);
    } else {
        console.log('❌ Thalaiyuthu customer not found');
    }

    // 2. Dhivyaa
    console.log('Searching for Dhivyaa...');
    const c2 = await Customer.findOneAndUpdate(
        { name: /DHIVYAA/i }, 
        { $inc: { debit: -81392, closingBalance: -81392, totalBalance: -81392 } }, 
        { new: true }
    );
    if (c2) {
        console.log(`✅ Fixed ${c2.name}: New Debit=${c2.debit}, New Closing=${c2.closingBalance}`);
    } else {
        console.log('❌ Dhivyaa customer not found');
    }

    console.log('Cleanup complete.');
    process.exit(0);
  } catch (err) {
    console.error('Error during cleanup:', err);
    process.exit(1);
  }
}

fixBalances();
