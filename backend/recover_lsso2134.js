import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const SalesOrderSchema = new mongoose.Schema({}, { strict: false });
const SalesOrder = mongoose.model("SalesOrder2", SalesOrderSchema, "salesorders");

const VoucherTypeSchema = new mongoose.Schema({}, { strict: false });
const VoucherType = mongoose.model("VoucherType", VoucherTypeSchema, "vouchertypes");

function getFinancialYear() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const shortYear = String(year).slice(-2);
  const nextShortYear = String(year + 1).slice(-2);
  const prevShortYear = String(year - 1).slice(-2);
  if (month >= 4) return `${shortYear}-${nextShortYear}`;
  return `${prevShortYear}-${shortYear}`;
}

async function recover() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected!");

  // Find the cancelled LSSO/2134/26-27 order
  const cancelledOrder = await SalesOrder.findOne({ invoiceId: "LSSO/2134/26-27" }).lean();
  if (!cancelledOrder) {
    console.log("❌ Could not find LSSO/2134/26-27");
    return;
  }
  
  console.log("Found cancelled order:", cancelledOrder.invoiceId, "Status:", cancelledOrder.status);
  console.log("Customer:", cancelledOrder.customer?.name);
  console.log("Grand Total:", cancelledOrder.grandTotal);
  console.log("Items count:", cancelledOrder.items?.length);
  console.log("Current orderDate:", cancelledOrder.orderDate);

  // Generate next LSSO number
  const currentFY = getFinancialYear();
  const voucher = await VoucherType.findOne({
    branchId: cancelledOrder.branchId,
    name: "ls",
    orderType: "SO"
  });
  
  console.log("Voucher:", voucher?.name, "Prefix:", voucher?.prefix, "Counter:", voucher?.counter);

  const existingOrders = await SalesOrder.find({
    branchId: cancelledOrder.branchId,
    invoiceId: new RegExp(`^LSSO/`),
    financialYear: currentFY
  }).select('invoiceId').lean();

  let highestNumInDB = 0;
  existingOrders.forEach(order => {
    const parts = order.invoiceId.split('/');
    if (parts.length >= 2) {
      const num = parseInt(parts[1]);
      if (!isNaN(num) && num > highestNumInDB) highestNumInDB = num;
    }
  });

  const nextNum = Math.max(voucher?.counter || 1, highestNumInDB + 1);
  const newInvoiceId = `LSSO/${String(nextNum).padStart(3, "0")}/${currentFY}`;
  console.log("\n🆕 New invoiceId would be:", newInvoiceId);
  console.log("New date would be: 2026-05-28");
  console.log("\nRun this script again with --confirm flag to actually create the order");

  if (process.argv.includes("--confirm")) {
    console.log("\n⏳ Creating new order...");
    
    const newOrderData = {
      ...cancelledOrder,
      _id: new mongoose.Types.ObjectId(),
      invoiceId: newInvoiceId,
      orderDate: new Date("2026-05-28"),
      status: "PLACED",
      invoiceGenerated: false,
      salesInvoiceId: undefined,
      editHistory: [],
      cancelNarration: undefined,
      cancelledBy: undefined,
      cancelledAt: undefined,
      reEditRequestStatus: "NONE",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    delete newOrderData._id;
    delete newOrderData.salesInvoiceId;
    delete newOrderData.cancelNarration;
    delete newOrderData.cancelledBy;
    delete newOrderData.cancelledAt;
    delete newOrderData.lastInvoicedItems;
    delete newOrderData.lastInvoicedGrandTotal;
    delete newOrderData.lastInvoicedCustomerId;
    delete newOrderData.invoiceItems;
    
    const newOrder = new SalesOrder({ ...newOrderData, _id: new mongoose.Types.ObjectId(), invoiceId: newInvoiceId, orderDate: new Date("2026-05-28"), status: "PLACED", invoiceGenerated: false, editHistory: [], reEditRequestStatus: "NONE" });
    await newOrder.save();
    
    // Update voucher counter
    if (voucher) {
      await VoucherType.findByIdAndUpdate(voucher._id, { counter: nextNum + 1 });
    }
    
    console.log("✅ New order created:", newInvoiceId);
    console.log("✅ Order ID:", newOrder._id);
    console.log("\nℹ️  Note: The new order is in PLACED status — you need to generate the invoice for it.");
    console.log("ℹ️  Customer balance and stock were already reverted when the original was cancelled.");
  }

  await mongoose.disconnect();
}

recover().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
