import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Customer from '../models/Customer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const ids = ['69dcbb75c21f8963ebb2b706', '69cc826d90a268b9a0b7bb77'];
  const customers = await Customer.find({ _id: { $in: ids } }).lean();
  console.log(JSON.stringify(customers.map(c => ({
    id: c._id.toString(),
    name: c.name,
    branchId: c.branchId.toString(),
  })), null, 2));
  process.exit();
}).catch(err => {
  console.error(err);
  process.exit(1);
});
