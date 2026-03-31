import dotenv from "dotenv";
import mongoose from "mongoose";
import Invoice from "./models/Invoice.js";

dotenv.config();

async function testGSTZenData() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected\n");

    // Get the first invoice with status FINALIZED
    const invoice = await Invoice.findOne({ status: "FINALIZED" })
      .populate("branchId")
      .populate("customer.customerId")
      .populate("items.productId");

    if (!invoice) {
      console.log("❌ No finalized invoices found. Create one first.");
      process.exit(0);
    }

    console.log("📄 Invoice Found:", invoice.invoiceNumber);
    console.log("\n✅ REQUIRED FIELDS CHECK:\n");

    // Check seller/branch GSTIN
    const sellerGstin = invoice.seller?.gstin || invoice.branchId?.gstin;
    console.log("1. Seller GSTIN:", sellerGstin ? `✅ ${sellerGstin}` : "❌ MISSING - Update branch profile");

    // Check customer GSTIN
    const customerGstin = invoice.customer?.gstin || "URP";
    console.log("2. Customer GSTIN:", customerGstin ? `✅ ${customerGstin}` : "❌ MISSING - Use 'URP' for unregistered");

    // Check invoice number
    console.log("3. Invoice Number:", invoice.invoiceNumber ? `✅ ${invoice.invoiceNumber}` : "❌ MISSING");

    // Check invoice date
    console.log("4. Invoice Date:", invoice.invoiceDate ? `✅ ${new Date(invoice.invoiceDate).toLocaleDateString()}` : "❌ MISSING");

    // Check items
    console.log(`5. Items: ✅ ${invoice.items?.length || 0} items`);

    if (invoice.items && invoice.items.length > 0) {
      console.log("\n📦 PRODUCT DETAILS:\n");
      invoice.items.forEach((item, idx) => {
        const hsn = item.productId?.hsnCode || item.hsn;
        const gst = item.gst || item.gstRate;
        console.log(`   Item ${idx + 1}:`);
        console.log(`      Name: ${item.name || "N/A"}`);
        console.log(`      HSN Code: ${hsn ? `✅ ${hsn}` : "❌ MISSING - Add HSN code to product"}`);
        console.log(`      Quantity: ${item.qty || item.quantity}`);
        console.log(`      GST Rate: ${gst ? `✅ ${gst}%` : "❌ MISSING"}`);
        console.log();
      });
    }

    // Check seller details
    console.log("\n🏢 SELLER DETAILS:\n");
    const seller = invoice.seller || invoice.branchId;
    console.log("   Name:", seller?.name || "N/A");
    console.log("   Address:", seller?.address || seller?.address1 || "N/A");
    console.log("   City:", seller?.city || "N/A");
    console.log("   Pincode:", seller?.pincode || "N/A");
    console.log("   State Code:", seller?.stateCode || "N/A");

    // Check customer details
    console.log("\n👤 CUSTOMER DETAILS:\n");
    const customer = invoice.customer;
    console.log("   Name:", customer?.name || "N/A");
    console.log("   Address:", customer?.address || "N/A");
    console.log("   City:", customer?.city || "N/A");
    console.log("   Pincode:", customer?.pincode || "N/A");
    console.log("   State Code:", customer?.stateCode || "N/A");

    // Check amounts
    console.log("\n💰 AMOUNTS:\n");
    console.log("   Subtotal:", invoice.subtotal || 0);
    console.log("   CGST:", invoice.totalTax?.cgst || 0);
    console.log("   SGST:", invoice.totalTax?.sgst || 0);
    console.log("   IGST:", invoice.totalTax?.igst || 0);
    console.log("   Total:", invoice.grandTotal || 0);

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("✅ If all fields above show ✅, you're ready for E-Invoice");
    console.log("❌ Fix any ❌ fields marked as MISSING");
    console.log("=".repeat(60));

    await mongoose.disconnect();
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

testGSTZenData();
