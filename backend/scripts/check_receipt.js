import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Receipt from '../models/Receipt.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const receipt = await Receipt.findOne({ receiptId: "REC/519/26-27" }).lean();
  console.log(JSON.stringify(receipt, null, 2));
  process.exit();
}).catch(err => {
  console.error(err);
  process.exit(1);
});
