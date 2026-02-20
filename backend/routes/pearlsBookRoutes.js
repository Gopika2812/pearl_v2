import { createCanvas } from "canvas";
import express from "express";
import cloudinary from "../config/cloudinary.js";
import Commission from "../models/Commission.js";
import CommissionRule from "../models/CommissionRule.js";
import Customer from "../models/Customer.js";
import DeliveryMan from "../models/DeliveryMan.js";
import Product from "../models/Product.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import SalesMan from "../models/SalesMan.js";
import SalesOrder from "../models/SalesOrder.js";
import SalesOwner from "../models/SalesOwner.js";

const router = express.Router();

/* ---------------- GET PEARLS BOOK ---------------- */
router.get("/", async (req, res) => {
  try {
    const purchases = await PurchaseOrder.find().lean();
    const sales = await SalesOrder.find().lean();

    const purchaseMapped = purchases.map((p) => ({
      _id: p._id,
      type: "PURCHASE",
      date: p.date,
      invoiceId: p.invoiceId,
      party: p.vendor,
      warehouse: p.warehouse,
      items: p.items,
      subtotal: p.subtotal,
      totalTax: p.totalTax,
      transportCharge: p.transportCharge || 0,
      grandTotal: p.grandTotal,
    }));

    const salesMapped = sales.map((s) => ({
      _id: s._id,
      type: "SALES",
      date: s.createdAt,
      invoiceId: s.invoiceId,
      party: s.customer?.name || "",
      warehouse: s.warehouse,

      openingBalance: s.openingBalance,
      closingBalance: s.closingBalance,

      items: s.items,
      subtotal: s.subtotal,
      totalTax: s.totalTax,
      transportCharge: s.transportCharge,
      grandTotal: s.grandTotal,
    }));



    const merged = [...purchaseMapped, ...salesMapped].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    res.json(merged);
  } catch (err) {
    res.status(500).json({ message: "Failed to load Pearls Book" });
  }
});

async function checkStockAvailability(saleItems, warehouse) {
  for (const saleItem of saleItems) {
    console.log(`\n📦 Checking stock for: ${saleItem.name} (ProductId: ${saleItem.productId})`);
    
    // Check Product model's totalQty (source of truth)
    const product = await Product.findById(saleItem.productId);

    if (!product) {
      throw new Error(`Product not found: ${saleItem.name}`);
    }

    const totalAvailable = product.totalQty || 0;
    console.log(`  📍 Warehouse: ${warehouse}`);
    console.log(`  Product totalQty: ${totalAvailable}, Required: ${saleItem.qty}`);

    if (totalAvailable < saleItem.qty) {
      throw new Error(
        `Insufficient stock for ${saleItem.name}. Available: ${totalAvailable}`
      );
    }
  }
}


async function reduceStockFIFO(saleItems, warehouse) {
  const lowStockAlerts = [];

  for (const saleItem of saleItems) {
    // Reduce from Product totalQty
    const product = await Product.findById(saleItem.productId);

    if (!product) {
      throw new Error(`Product not found: ${saleItem.name}`);
    }

    // Reduce totalQty
    const newTotalQty = product.totalQty - saleItem.qty;
    await Product.findByIdAndUpdate(saleItem.productId, {
      totalQty: newTotalQty
    });

    console.log(`✅ Stock reduced for ${saleItem.name}: ${product.totalQty} → ${newTotalQty}`);

    // Check for low stock alert
    if (newTotalQty < 10) {
      lowStockAlerts.push({
        product: saleItem.name,
        warehouse: warehouse,
        remainingQty: newTotalQty,
      });
    }
  }

  return lowStockAlerts;
}



function drawCompanyHeader(ctx, canvasWidth) {
  ctx.textAlign = "center";

  // Company name
  ctx.fillStyle = "#1a365d";
  ctx.font = "bold 24px Arial";
  ctx.fillText("PEARL AGENCY", canvasWidth / 2, 50);

  ctx.fillStyle = "#000";
  ctx.font = "14px Arial";
  ctx.fillText("12/13, South By-Pass Road,", canvasWidth / 2, 75);
  ctx.fillText("Vanarpettai, Tirunelveli - 627003", canvasWidth / 2, 95);
  ctx.fillText("Mobile No: 9429692970", canvasWidth / 2, 115);
  ctx.fillText("GSTIN/UIN: 33DULPS2600Q1Z6", canvasWidth / 2, 135);
  ctx.fillText("GPAY No: 8825847884", canvasWidth / 2, 155);
  ctx.fillText("State Name: Tamil Nadu, Code: 33", canvasWidth / 2, 175);

  // Generated time (right aligned)
  ctx.textAlign = "right";
  ctx.font = "12px Arial";
  ctx.fillStyle = "#444";
  ctx.fillText(
    `Generated on: ${getFormattedDateTime()}`,
    canvasWidth - 20,
    200
  );

  // Divider
  ctx.strokeStyle = "#999";
  ctx.beginPath();
  ctx.moveTo(20, 215);
  ctx.lineTo(canvasWidth - 20, 215);
  ctx.stroke();

  ctx.textAlign = "left";
}


function drawBorder(ctx, width, height) {
  ctx.strokeStyle = "#2b6cb0"; // blue border
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, width - 20, height - 20);
}

function getFormattedDateTime() {
  const now = new Date();
  return now.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// ---------------- GENERATE INVOICE IMAGE ----------------
async function generateInvoiceImage(sale) {
  const canvas = createCanvas(595, 842); // A4
  const ctx = canvas.getContext("2d");

  // ===== BACKGROUND =====
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 595, 842);

  drawBorder(ctx, 595, 842);
  drawCompanyHeader(ctx, 595);

  // ===== TITLE =====
  ctx.textAlign = "center";
  ctx.fillStyle = "#2f855a";
  ctx.font = "bold 20px Arial";
  ctx.fillText("BILL INVOICE", 297, 245);
  ctx.textAlign = "left";

  // ===== INVOICE META =====
  let y = 270;
  ctx.font = "13px Arial";

  drawText(ctx, `Invoice No : ${sale.invoiceId}`, 30, y);
  drawText(ctx, `Date : ${new Date(sale.createdAt).toLocaleDateString("en-IN")}`, 360, y);

  y += 20;
  drawText(ctx, `Warehouse : ${sale.warehouse}`, 30, y);
  drawText(ctx, `Billing Person : ${sale.billingPerson || "-"}`, 360, y);

  y += 20;
  drawText(ctx, `Sales Man : ${sale.salesManName || "-"}`, 30, y);
  drawText(ctx, `Delivery Man : ${sale.deliveryManName || "-"}`, 360, y);

  // ===== SUPPLIER & BUYER =====
  y += 25;
  drawLine(ctx, 20, y, 575, y);
  y += 20;

  // SUPPLIER
  drawText(ctx, "Supplier (From)", 30, y, 13, true);
  drawText(ctx, "Buyer (Bill To)", 310, y, 13, true);

  y += 18;

  drawText(ctx, "PEARL AGENCY", 30, y, 12, true);
  drawText(ctx, sale.customer.name, 310, y, 12, true);

  y += 16;
  drawText(ctx, "12/13, South By-Pass Road,", 30, y);
  drawText(ctx, sale.customer.address, 310, y);

  y += 16;
  drawText(ctx, "Vanarpettai, Tirunelveli - 627003", 30, y);
  drawText(
    ctx,
    `${sale.customer.district}, ${sale.customer.state} - ${sale.customer.pincode}`,
    310,
    y
  );

  y += 16;
  drawText(ctx, "GSTIN : 33DULPS2600Q1Z6", 30, y);
  drawText(ctx, `Mobile : ${sale.customer.whatsapp}`, 310, y);

  y += 16;
  drawText(ctx, "State : Tamil Nadu (33)", 30, y);

  // ===== ITEMS TABLE =====
  y += 30;
  drawLine(ctx, 20, y, 575, y);
  y += 25;

  ctx.font = "bold 12px Arial";
  ctx.fillText("Item", 30, y);
  ctx.fillText("HSN", 180, y);
  ctx.fillText("Qty", 230, y);
  ctx.fillText("Rate", 270, y);
  ctx.fillText("Disc", 320, y);
  ctx.fillText("GST%", 370, y);
  ctx.fillText("Tax", 420, y);
  ctx.fillText("Total", 480, y);

  drawLine(ctx, 20, y + 5, 575, y + 5);
  y += 22;

  ctx.font = "12px Arial";

  sale.items.forEach((item) => {
    const taxAmount =
      ((item.sellingPrice * item.qty - item.discountAmount) * item.gst) / 100;
    const roundedTotal = Math.ceil(item.total * 100) / 100;

    ctx.fillText(item.name, 30, y);
    ctx.fillText(item.hsn, 180, y);
    ctx.fillText(item.qty.toString(), 230, y);
    ctx.fillText(`₹${(item.sellingPrice).toFixed(2)}`, 270, y);
    ctx.fillText(`₹${(item.discountAmount).toFixed(2)}`, 320, y);
    ctx.fillText(`${item.gst}%`, 370, y);
    ctx.fillText(`₹${(Math.ceil(taxAmount * 100) / 100).toFixed(2)}`, 420, y);
    ctx.fillText(`₹${roundedTotal.toFixed(2)}`, 480, y);

    y += 20;
  });

  drawLine(ctx, 20, y + 5, 575, y + 5);

  // ===== TOTAL SUMMARY =====
  y += 25;
  ctx.font = "bold 13px Arial";

  const roundedSubtotal = Math.ceil(sale.subtotal * 100) / 100;
  const roundedDiscount = Math.ceil(sale.totalDiscount * 100) / 100;
  const roundedTax = Math.ceil(sale.totalTax * 100) / 100;
  const roundedTransport = Math.ceil(sale.transportCharge * 100) / 100;
  const roundedGrandTotal = Math.ceil(sale.grandTotal * 100) / 100;

  drawText(ctx, `Sub Total : ₹${roundedSubtotal.toFixed(2)}`, 360, y);
  y += 18;

  drawText(ctx, `Total Discount : ₹${roundedDiscount.toFixed(2)}`, 360, y);
  y += 18;

  drawText(ctx, `GST : ₹${roundedTax.toFixed(2)}`, 360, y);
  y += 18;

  drawText(ctx, `Transport Charges : ₹${roundedTransport.toFixed(2)}`, 360, y);
  y += 20;

  ctx.font = "bold 15px Arial";
  ctx.fillStyle = "#c53030";
  drawText(ctx, `GRAND TOTAL : ₹${roundedGrandTotal.toFixed(2)}`, 360, y);

  // ===== FOOTER =====
  ctx.fillStyle = "#555";
  ctx.font = "italic 11px Arial";


  // ===== UPLOAD =====
  const buffer = canvas.toBuffer("image/png");

  const upload = await cloudinary.uploader.upload(
    `data:image/png;base64,${buffer.toString("base64")}`,
    {
      folder: "pearls-erp/invoices",
      public_id: `INV_${sale.invoiceId}_${Date.now()}`

    }
  );

  return upload.secure_url;
}


function drawLine(ctx, x1, y1, x2, y2) {
  ctx.strokeStyle = "#999";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawText(ctx, text, x, y, size = 12, bold = false) {
  ctx.font = `${bold ? "bold" : ""} ${size}px Arial`;
  ctx.fillStyle = "#000";
  ctx.fillText(text, x, y);
}


async function generateEwayBillImage(sale) {
  const canvas = createCanvas(595, 900);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 595, 900);

  drawBorder(ctx, 595, 900);

  // ===== HEADER =====
  ctx.fillStyle = "#805ad5";
  ctx.font = "bold 22px Arial";
  ctx.fillText("E-WAY BILL", 210, 40);

  drawLine(ctx, 20, 50, 575, 50);

  // ================= SUPPLIER (FROM) =================
  let sy = 80;

  drawText(ctx, "Supplier (From)", 30, sy, 14, true);
  sy += 22;

  drawText(ctx, "PEARL AGENCY", 30, sy, 12, true);
  sy += 18;

  drawText(ctx, "12/13, South By-Pass Road,", 30, sy);
  sy += 16;

  drawText(ctx, "Vanarpettai, Tirunelveli - 627003", 30, sy);
  sy += 16;

  drawText(ctx, "Mobile No : 9429692970", 30, sy);
  sy += 16;

  drawText(ctx, "GSTIN/UIN : 33DULPS2600Q1Z6", 30, sy);
  sy += 16;

  drawText(ctx, "GPAY No : 8825847884", 30, sy);
  sy += 16;

  drawText(ctx, "State Name : Tamil Nadu, Code : 33", 30, sy);
  sy += 16;

  drawText(ctx, "E-Mail : agencypearl@gmail.com", 30, sy);
  sy += 16;

  drawText(ctx, `Warehouse : ${sale.warehouse}`, 30, sy);
  sy += 20;

  // ================= CUSTOMER (TO) =================
  let cy = 80;

  drawText(ctx, "Recipient (To)", 310, cy, 14, true);
  cy += 22;

  drawText(ctx, `Name : ${sale.customer.name}`, 310, cy);
  cy += 18;

  drawText(ctx, `Address : ${sale.customer.address}`, 310, cy);
  cy += 18;

  drawText(
    ctx,
    `State : ${sale.customer.state} - ${sale.customer.pincode}`,
    310,
    cy
  );
  cy += 18;

  // ===== COMMON DIVIDER (AUTO HEIGHT) =====
  const detailsEndY = Math.max(sy, cy) + 10;
  drawLine(ctx, 20, detailsEndY, 575, detailsEndY);

  // ================= E-WAY DETAILS =================
  let ey = detailsEndY + 25;

  drawText(ctx, "E-Way Bill Details", 30, ey, 14, true);

  drawText(ctx, `Invoice No : ${sale.invoiceId}`, 30, ey + 25);
  drawText(ctx, `E-Way Bill No : ${sale.ewayDetails.ewayBillNo}`, 30, ey + 45);
  drawText(ctx, `E-Way Date : ${sale.ewayDetails.ewayDate}`, 30, ey + 65);

  drawText(ctx, `Vehicle No : ${sale.ewayDetails.vehicleNo}`, 310, ey + 25);
  drawText(ctx, `Mode : ${sale.ewayDetails.transportMode}`, 310, ey + 45);
  drawText(ctx, `Transporter : ${sale.ewayDetails.transporterName}`, 310, ey + 65);

  drawLine(ctx, 20, ey + 85, 575, ey + 85);

  // ================= ITEM TABLE =================
  let y = ey + 110;

  ctx.font = "bold 12px Arial";
  ctx.fillText("Product", 30, y);
  ctx.fillText("Qty", 210, y);
  ctx.fillText("Price", 250, y);
  ctx.fillText("GST%", 310, y);
  ctx.fillText("CGST", 360, y);
  ctx.fillText("SGST", 420, y);
  ctx.fillText("Total", 480, y);

  drawLine(ctx, 20, y + 5, 575, y + 5);

  ctx.font = "12px Arial";
  y += 25;

  sale.items.forEach((item) => {
    ctx.fillText(item.name, 30, y);
    ctx.fillText(item.qty.toString(), 210, y);
    ctx.fillText(`₹${item.sellingPrice}`, 250, y);
    ctx.fillText(`${item.gst}%`, 310, y);
    ctx.fillText(`₹${item.cgst}`, 360, y);
    ctx.fillText(`₹${item.sgst}`, 420, y);
    ctx.fillText(`₹${item.total}`, 480, y);
    y += 22;
  });

  drawLine(ctx, 20, y + 5, 575, y + 5);

  // ================= TOTAL SUMMARY =================
  y += 30;
  drawText(ctx, `Sub Total : ₹${sale.subtotal}`, 350, y);
  y += 20;
  drawText(ctx, `Tax : ₹${sale.totalTax}`, 350, y);
  y += 20;
  drawText(ctx, `Transport : ₹${sale.transportCharge}`, 350, y);
  y += 20;
  drawText(ctx, `Grand Total : ₹${sale.grandTotal}`, 350, y, 14, true);




  const buffer = canvas.toBuffer("image/png");

  const upload = await cloudinary.uploader.upload(
    `data:image/png;base64,${buffer.toString("base64")}`,
    {
      folder: "pearls-erp/e-way-bills",
      public_id: `EWAY_${sale.invoiceId}_${Date.now()}`,
    }
  );

  return upload.secure_url;
}

router.post("/generate-invoice/:id", async (req, res) => {
  try {
    const sale = await SalesOrder.findById(req.params.id)
      .populate('salesMan', 'name')
      .populate('deliveryMan', 'name')
      .lean();

    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }

    // Extract names from populated fields
    sale.salesManName = sale.salesMan?.name || "-";
    sale.deliveryManName = sale.deliveryMan?.name || "-";

    // ✅ 1. CHECK STOCK (WAREHOUSE AWARE)
    await checkStockAvailability(sale.items, sale.warehouse);

    // ✅ 2. GENERATE INVOICE
    const invoiceImage = await generateInvoiceImage(sale);
    let ewayImage = null;

    if (sale.ewayEnabled) {
      ewayImage = await generateEwayBillImage(sale);
    }

    // ✅ 3. REDUCE STOCK (WAREHOUSE + FIFO)
    const lowStockAlerts = await reduceStockFIFO(
      sale.items,
      sale.warehouse
    );

    // ✅ 4. UPDATE CUSTOMER BALANCE (AFTER INVOICE GENERATION)
    const orderValue = sale.grandTotalWithMargin || sale.grandTotal;
    const customer = await Customer.findById(sale.customer.customerId);

    if (!customer) {
      throw new Error("Customer not found");
    }

    // Add sales order amount to customer closing balance
    const updatedClosingBalance = customer.closingBalance + orderValue;
    await Customer.findByIdAndUpdate(sale.customer.customerId, {
      closingBalance: updatedClosingBalance,
      totalBalance: updatedClosingBalance,
    });

    // ✅ Mark invoice as generated and update closing balance in SalesOrder
    await SalesOrder.findByIdAndUpdate(req.params.id, {
      invoiceGenerated: true,
      closingBalance: updatedClosingBalance,
    });

    console.log(`✅ Customer balance updated: ₹${customer.closingBalance} → ₹${updatedClosingBalance}`);

    // ✅ 5. CREATE COMMISSIONS (AFTER INVOICE GENERATION)
    try {
      const salesOwnerDoc = sale.salesOwner ? await SalesOwner.findById(sale.salesOwner) : null;
      const salesManDoc = sale.salesMan ? await SalesMan.findById(sale.salesMan) : null;
      const deliveryManDoc = sale.deliveryMan ? await DeliveryMan.findById(sale.deliveryMan) : null;

      // Function to get applicable commission for a person based on role type
      const getCommission = async (personId, roleType) => {
        if (!personId) return { percentage: 0, amount: 0 };
        
        // Find applicable commission rule (highest minimum order value that doesn't exceed order value)
        const rule = await CommissionRule.findOne({
          personId: personId,
          roleType: roleType,
          minimumOrderValue: { $lte: orderValue },
          isActive: true,
        }).sort({ minimumOrderValue: -1 });
        
        if (!rule) return { percentage: 0, amount: 0 };
        
        const commissionAmount = (orderValue * rule.commissionPercentage) / 100;
        return { percentage: rule.commissionPercentage, amount: commissionAmount };
      };

      // Get applicable commissions for all three roles
      const soCommission = await getCommission(sale.salesOwner, "SalesOwner");
      const smCommission = await getCommission(sale.salesMan, "SalesMan");
      const dmCommission = await getCommission(sale.deliveryMan, "DeliveryMan");

      const commissionData = {
        salesOrderId: sale._id,
        orderValue: orderValue,
        invoiceId: sale.invoiceId,

        // Sales Owner
        salesOwnerId: salesOwnerDoc?._id,
        salesOwnerName: salesOwnerDoc?.name,
        salesOwnerCommissionPercentage: soCommission.percentage,
        salesOwnerCommissionAmount: soCommission.amount,

        // Sales Man
        salesManId: salesManDoc?._id,
        salesManName: salesManDoc?.name,
        salesManCommissionPercentage: smCommission.percentage,
        salesManCommissionAmount: smCommission.amount,

        // Delivery Man
        deliveryManId: deliveryManDoc?._id,
        deliveryManName: deliveryManDoc?.name,
        deliveryManCommissionPercentage: dmCommission.percentage,
        deliveryManCommissionAmount: dmCommission.amount,
      };

      commissionData.totalCommission =
        commissionData.salesOwnerCommissionAmount +
        commissionData.salesManCommissionAmount +
        commissionData.deliveryManCommissionAmount;

      const commission = new Commission(commissionData);
      await commission.save();

      // Update commission amounts for sales personnel
      if (commission.salesOwnerId && commission.salesOwnerCommissionAmount > 0) {
        await SalesOwner.findByIdAndUpdate(commission.salesOwnerId, {
          $inc: { commissionAmount: commission.salesOwnerCommissionAmount }
        });
        console.log(`✅ Sales Owner commission added: ₹${commission.salesOwnerCommissionAmount}`);
      }

      if (commission.salesManId && commission.salesManCommissionAmount > 0) {
        await SalesMan.findByIdAndUpdate(commission.salesManId, {
          $inc: { commissionAmount: commission.salesManCommissionAmount }
        });
        console.log(`✅ Sales Man commission added: ₹${commission.salesManCommissionAmount}`);
      }

      if (commission.deliveryManId && commission.deliveryManCommissionAmount > 0) {
        await DeliveryMan.findByIdAndUpdate(commission.deliveryManId, {
          $inc: { commissionAmount: commission.deliveryManCommissionAmount }
        });
        console.log(`✅ Delivery Man commission added: ₹${commission.deliveryManCommissionAmount}`);
      }

      console.log("✅ Commission record created:", commission._id);
    } catch (commissionError) {
      console.error("⚠️ Commission creation failed:", commissionError.message);
    }

    // ✅ 6. WHATSAPP
    const phone = `91${sale.customer.whatsapp}`;
    const message = encodeURIComponent(
      `Hello ${sale.customer.name},\n\nInvoice No: ${sale.invoiceId}\nAmount: ₹${sale.grandTotal}\n\n📄 Invoice: ${invoiceImage}`
    );

    res.json({
      success: true,
      invoiceImage,
      ewayImage,
      lowStockAlerts,
      waUrl: `https://wa.me/${phone}?text=${message}`,
    });
  } catch (err) {
    console.error("INVOICE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

export default router;