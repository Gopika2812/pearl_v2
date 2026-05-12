
const mongoose = require('mongoose');
const moment = require('moment-timezone');

const MONGO_URI = "mongodb+srv://gopikap2812_db_user:3EprufLKuDVKIdo3@branchesdb.njfcfju.mongodb.net/pearls_erp?retryWrites=true&w=majority";

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: String,
  invoiceDate: Date,
  status: String,
  customer: { name: String, gstin: String },
  items: [{ name: String, gst: Number, sellingPrice: Number, qty: Number }]
}, { strict: false });

const Invoice = mongoose.model('Invoice', invoiceSchema);

async function findFourPercent() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to DB");

    const IST = "Asia/Kolkata";
    const startDate = moment.tz("2026-04-01", "YYYY-MM-DD", IST).startOf("month").toDate();
    const endDate = moment.tz("2026-04-01", "YYYY-MM-DD", IST).endOf("month").toDate();

    const invoices = await Invoice.find({
      invoiceDate: { $gte: startDate, $lte: endDate },
      "items.gst": 4
    }).lean();

    console.log(`\nFound ${invoices.length} invoices with 4% GST in April 2026:`);
    
    invoices.forEach(inv => {
      console.log(`\n-----------------------------------`);
      console.log(`Invoice: ${inv.invoiceNumber}`);
      console.log(`Date: ${moment(inv.invoiceDate).format("DD-MMM-YYYY")}`);
      console.log(`Customer: ${inv.customer?.name} (${inv.customer?.gstin || "URP"})`);
      console.log(`Items with 4%:`);
      inv.items.forEach(item => {
        if (item.gst === 4) {
          console.log(` - ${item.name} | Qty: ${item.qty} | Rate: ${item.sellingPrice}`);
        }
      });
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

findFourPercent();
