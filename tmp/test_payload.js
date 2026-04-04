import dotenv from "dotenv";
import mongoose from "mongoose";
import gstzenService from "../backend/utils/gstzenService.js";

dotenv.config({ path: "../backend/.env" });

async function testPayloadGeneration() {
  const dummyInvoice = {
    invoiceNumber: "INV/TEST/001",
    invoiceDate: new Date(),
    branchId: {
      name: "Test Branch",
      address: "123 Test St",
      city: "Test City",
      pincode: "627001",
      gstin: "33TESTGSTIN1234",
      stateCode: "33"
    },
    customer: {
      name: "Test Customer",
      address: "456 Buyer St",
      city: "Buyer City",
      pincode: "628001",
      gstin: "33BUYERGSTIN5678",
      stateCode: "33"
    },
    items: [
      {
        name: "Test Product",
        hsn: "123456",
        qty: 10,
        sellingPrice: 100,
        discountAmount: 0,
        gst: 18
      }
    ],
    grandTotal: 1180
  };

  console.log("🛠️ Mocking generateEInvoice payload...");
  
  // Since we want to see the payload WITHOUT actually calling the API (to avoid using real API key/hitting real endpoint)
  // we would need to mock the apiClient or just look at the code logic.
  // But wait, I can just modify the service temporarily to print the payload.
}

testPayloadGeneration();
