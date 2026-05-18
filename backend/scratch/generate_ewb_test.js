import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import Branch from '../models/Branch.js';

async function run() {
  try {
    const uri = process.env.MONGO_URI;
    await mongoose.connect(uri);
    
    // Dynamically import the service
    const { default: gstzenService } = await import('../utils/gstzenService.js');
    
    // Find the invoice LSSI/1720/26-27
    const invoice = await Invoice.findOne({ invoiceNumber: "LSSI/1720/26-27" }).populate("branchId");
    if (!invoice) {
      console.error("Invoice not found!");
      await mongoose.disconnect();
      return;
    }
    
    console.log(`Found Invoice: ${invoice.invoiceNumber}`);
    console.log(`Current VehicleNo: ${invoice.vehicleNo || "None"}`);
    console.log(`Current IRN: ${invoice.irn}`);
    
    // Set valid vehicle number
    invoice.vehicleNo = "TN72CD0229";
    
    // Distances to try: 1, 2, 3, 5, 10, 15
    const distances = [1, 2, 3, 5, 10, 15];
    
    for (const d of distances) {
      console.log(`\n--------------------------------------------------`);
      console.log(`Testing Standalone E-Way Bill generation with Distance = ${d} km...`);
      invoice.transportDistance = d;
      
      const res = await gstzenService.generateEWayBill(invoice, { irn: invoice.irn });
      console.log(`Result for ${d} km:`, JSON.stringify(res, null, 2));
      
      if (res.success) {
        // Save changes if successful
        invoice.ewayBillNo = res.ewayBillNo;
        invoice.ewayBillDate = res.ewayBillDate;
        invoice.ewayBillValidUntil = res.ewayBillValidUntil;
        invoice.ewayBillPdfUrl = res.ewayBillPdfUrl;
        await invoice.save();
        console.log(`\n🎉 SUCCESS! Invoice updated with E-Way Bill at ${d} km!`);
        break;
      }
    }
    
    await mongoose.disconnect();
  } catch (err) {
    console.error("Test error:", err);
  }
}
run();
