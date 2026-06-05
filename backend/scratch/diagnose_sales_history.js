import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({path: '../.env'});
import SalesOrder from '../models/SalesOrder.js';
import Product from '../models/Product.js';

mongoose.connect(process.env.MONGO_URI).then(async () => {
  // Find a sales order with "GNG Grains Foro L 1-5"
  const orders = await SalesOrder.find({
    "items.name": { $regex: 'GNG Grains Foro L 1-5', $options: 'i' }
  }).sort({ createdAt: -1 }).limit(5);

  console.log(`Found ${orders.length} orders with that product name.`);

  for (const order of orders) {
    const item = order.items.find(i => i.name.match(/GNG Grains Foro L 1-5/i));
    const prodId = item.productId;
    const prod = await Product.findById(prodId);
    
    console.log("------------------------");
    console.log(`Order ID: ${order._id}, Date: ${order.createdAt}`);
    console.log(`Product ID: ${prodId}`);
    if (prod) {
       console.log(`Product Name: ${prod.name}, Current Purchase Price: ${prod.purchasingPrice}`);
       console.log(`Price History Length: ${prod.priceHistory ? prod.priceHistory.length : 0}`);
       if (prod.priceHistory && prod.priceHistory.length > 0) {
           console.log("First history entry:", prod.priceHistory[0]);
       }
    } else {
       console.log("PRODUCT NOT FOUND IN DB");
    }
  }

  process.exit();
}).catch(console.error);
