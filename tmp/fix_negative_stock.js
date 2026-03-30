import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: './backend/.env' });

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('MONGO_URI not found in .env');
  process.exit(1);
}

const productSchema = new mongoose.Schema({
  name: String,
  totalQty: Number,
}, { strict: false });

const salesOrderSchema = new mongoose.Schema({
  invoiceId: String,
  items: Array,
  invoiceGenerated: Boolean,
}, { strict: false });

const purchaseOrderSchema = new mongoose.Schema({
  invoiceId: String,
  items: Array,
  status: String,
}, { strict: false });

const Product = mongoose.model('Product', productSchema);
const SalesOrder = mongoose.model('SalesOrder', salesOrderSchema);
const PurchaseOrder = mongoose.model('PurchaseOrder', purchaseOrderSchema);

async function fixStock() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const productName = 'AH Chicken Samosa (1*20)';
    const product = await Product.findOne({ name: productName });

    if (!product) {
      console.log('Product not found');
      return;
    }

    // --- PURCHASE HISTORY (Sum of all INVOICED POs) ---
    const pos = await PurchaseOrder.find({
      'items.productId': product._id,
      status: 'INVOICED'
    });
    
    let totalPurchased = 0;
    pos.forEach(po => {
      const item = po.items.find(i => i.productId.toString() === product._id.toString());
      if (item) totalPurchased += item.qty;
    });

    // --- SALES HISTORY (Sum of all INVOICED SOs) ---
    // Standard Items
    const sosItems = await SalesOrder.find({
      'items.productId': product._id,
      invoiceGenerated: true
    });
    
    let totalSoldItems = 0;
    sosItems.forEach(so => {
      const item = so.items.find(i => i.productId.toString() === product._id.toString());
      if (item) totalSoldItems += item.qty;
    });

    // Sample Items
    const sosSamples = await SalesOrder.find({
      'sampleItems.productId': product._id,
      invoiceGenerated: true
    });
    
    let totalSoldSamples = 0;
    sosSamples.forEach(so => {
         const item = so.sampleItems.find(i => i.productId && i.productId.toString() === product._id.toString());
         if (item) totalSoldSamples += item.qty;
    });

    const correctQty = totalPurchased - (totalSoldItems + totalSoldSamples);

    console.log(`\n--- Stock Correction for ${productName} ---`);
    console.log(`Total Invoiced Purchases: ${totalPurchased}`);
    console.log(`Total Invoiced Sales (Reg): ${totalSoldItems}`);
    console.log(`Total Invoiced Sales (Sample): ${totalSoldSamples}`);
    console.log(`Calculated Stock: ${correctQty}`);
    console.log(`Old (Buggy) Stock: ${product.totalQty}`);

    // Update Product Record
    product.totalQty = correctQty;
    await product.save();
    console.log(`✅ Success: Product Quantity updated to ${correctQty}`);

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

fixStock();
