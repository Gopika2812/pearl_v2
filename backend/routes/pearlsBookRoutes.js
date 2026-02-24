import { createCanvas, loadImage } from "canvas";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      items: Array.isArray(p.items) ? p.items : [],
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

      items: Array.isArray(s.items) ? s.items : [],
      sampleItems: Array.isArray(s.sampleItems) ? s.sampleItems : [],
      subtotal: s.subtotal,
      totalTax: s.totalTax,
      transportCharge: s.transportCharge,
      grandTotal: s.grandTotal,
      invoiceGenerated: s.invoiceGenerated || false,
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
  // Calculate HSN-wise tax summary
  const hsnSummary = {};
  if (Array.isArray(sale.items)) {
    sale.items.forEach((item) => {
      if (!hsnSummary[item.hsn]) {
        hsnSummary[item.hsn] = {
          hsn: item.hsn,
          taxableValue: 0,
          cgstRate: item.cgst || 0,
          sgstRate: item.sgst || 0,
          igstRate: item.igst || 0,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 0,
          totalTax: 0,
          total: 0,
        };
      }

      const baseAmount = item.sellingPrice * item.qty;
      const taxableValue = baseAmount - (item.discountAmount || 0);
      const cgstAmount = (taxableValue * item.cgst) / 100;
      const sgstAmount = (taxableValue * item.sgst) / 100;
      const igstAmount = (taxableValue * item.igst) / 100;

      hsnSummary[item.hsn].taxableValue += taxableValue;
      hsnSummary[item.hsn].cgstAmount += cgstAmount;
      hsnSummary[item.hsn].sgstAmount += sgstAmount;
      hsnSummary[item.hsn].igstAmount += igstAmount;
      hsnSummary[item.hsn].totalTax += cgstAmount + sgstAmount + igstAmount;
      hsnSummary[item.hsn].total += cgstAmount + sgstAmount + igstAmount + taxableValue;
    });
  }

  const hsnArray = Object.values(hsnSummary);
  const totalHsnItems = hsnArray.length;
  
  // Extra height for line spacing and back order section
  const itemLineSpacing = (sale.items?.length || 0) * 25; // Increased from 18 to 25 for extra spacing
  const backOrderHeight = (sale.backOrderSummary?.length || 0) > 0 ? 200 + (sale.backOrderSummary?.length || 0) * 20 : 0;
  const estimatedHeight = 250 + itemLineSpacing + totalHsnItems * 20 + 400 + backOrderHeight;

  const canvas = createCanvas(595, Math.max(1200, estimatedHeight));
  const ctx = canvas.getContext("2d");

  // ===== BACKGROUND =====
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 595, canvas.height);

  drawBorder(ctx, 595, canvas.height);

  // ===== LOAD AND DRAW LOGO =====
  let y = 15;
  try {
    const logoPath = path.join(__dirname, "../../public/logo.jpeg");
    const logo = await loadImage(logoPath);
    const logoWidth = 100;
    const logoHeight = 75;
    const logoCenterX = 297 - logoWidth / 2;
    ctx.drawImage(logo, logoCenterX, y, logoWidth, logoHeight);
    y += 90;
  } catch (err) {
    console.warn("Logo not found, skipping logo display:", err.message);
    y += 15;
  }

  // ===== COMPANY HEADER (CENTERED) =====
  y += 15;
  ctx.textAlign = "center";
  ctx.font = "12px Arial";
  ctx.fillStyle = "#000";
  ctx.fillText("12/13, South By-Pass Road, Vanarpettai,", 297, y);
  y += 15;
  ctx.fillText("Tirunelveli - 627003, Tamil Nadu", 297, y);
  y += 15;
  ctx.fillText("Mobile: 9429692970 | GSTIN: 33DULPS2600Q1Z6", 297, y);
  y += 13;
  ctx.fillText("GPAY No: 8825847884 | State: Tamil Nadu (Code: 33)", 297, y);

  // ===== HEADER - ACKNOWLEDGEMENT NO & DATE =====
  y += 18;
  ctx.font = "bold 13px Arial";
  ctx.fillText(`Acknowledgement No: ${sale.invoiceId}`, 297, y);
  y += 18;
  ctx.font = "12px Arial";
  ctx.fillText(`Acknowledgement Date: ${new Date(sale.createdAt).toLocaleDateString("en-IN")}`, 297, y);

  ctx.textAlign = "left";

  // ===== DIVIDER =====
  y += 18;
  drawLine(ctx, 20, y, 575, y);

  // ===== SENDER & BUYER DATA =====
  y += 15;

  // Sender
  ctx.font = "bold 11px Arial";
  ctx.fillText("SENDER (FROM)", 30, y);

  // Buyer
  ctx.fillText("BUYER (BILL TO)", 310, y);

  y += 15;
  ctx.font = "11px Arial";

  // Sender details
  drawText(ctx, "PEARL AGENCY", 30, y, 11, true);
  drawText(ctx, sale.customer.name, 310, y, 11, true);

  y += 14;
  drawText(ctx, "12/13, South By-Pass Road,", 30, y);
  // Split buyer address into 2 lines
  const addressLine1 = sale.customer.address || "";
  drawText(ctx, addressLine1, 310, y);

  y += 13;
  drawText(ctx, "Vanarpettai, Tirunelveli - 627003", 30, y);
  const addressLine2 = `${sale.customer.district}, ${sale.customer.state} - ${sale.customer.pincode}`;
  drawText(ctx, addressLine2, 310, y);

  y += 13;
  drawText(ctx, "GSTIN: 33DULPS2600Q1Z6", 30, y);
  drawText(ctx, `GSTIN: ${sale.customer.gstin || "-"}`, 310, y);

  y += 13;
  drawText(ctx, "Mobile: 9429692970", 30, y);
  drawText(ctx, `Mobile: ${sale.customer.whatsapp}`, 310, y);

  // ===== ORDER DETAILS =====
  y += 18;
  drawLine(ctx, 20, y, 575, y);
  y += 12;

  ctx.font = "11px Arial";
  drawText(ctx, `Invoice No: ${sale.invoiceId}`, 30, y);
  // Get billing person name
  const billingPersonName = sale.billingPersonName || "-";
  drawText(ctx, `Billing Person: ${billingPersonName}`, 310, y);

  y += 14;
  drawText(ctx, `Date: ${new Date(sale.createdAt).toLocaleDateString("en-IN")}`, 30, y);
  drawText(ctx, `Delivery Man: ${sale.deliveryManName || "-"}`, 310, y);

  // ===== ITEMS TABLE HEADER =====
  y += 20;
  drawLine(ctx, 20, y, 575, y);
  y += 13;

  ctx.font = "bold 10px Arial";
  ctx.fillStyle = "#1a365d";

  // Adjusted column positions for wider description and GST
  drawText(ctx, "Description of Goods", 25, y);
  drawText(ctx, "HSN", 200, y);
  drawText(ctx, "GST %", 260, y);
  drawText(ctx, "Qty", 305, y);
  drawText(ctx, "Rate", 345, y);
  drawText(ctx, "Unit", 430, y);
  drawText(ctx, "Total", 500, y);

  // ===== ITEMS TABLE BODY =====
  y += 12;
  drawLine(ctx, 20, y, 575, y);
  y += 12;

  ctx.font = "10px Arial";
  ctx.fillStyle = "#000";

  if (Array.isArray(sale.items)) {
    sale.items.forEach((item) => {
      const taxAmount = ((item.sellingPrice * item.qty - item.discountAmount) * item.gst) / 100;
      const roundedTotal = Math.ceil(item.total * 100) / 100;

      drawText(ctx, item.name.substring(0, 30), 25, y);
      drawText(ctx, item.hsn, 200, y);
      drawText(ctx, `${item.gst}%`, 260, y);
      drawText(ctx, item.qty.toString(), 305, y);
      drawText(ctx, `₹${item.sellingPrice.toFixed(2)}`, 345, y);
      drawText(ctx, "Kg", 430, y);
      drawText(ctx, `₹${roundedTotal.toFixed(2)}`, 500, y);

      // Extra line spacing for description of goods
      y += 25;
    });
  }

  // ===== ITEMS TABLE FOOTER =====
  drawLine(ctx, 20, y, 575, y);
  y += 15;

  ctx.font = "11px Arial";

  // Summary on right side
  const summaryX = 350;
  const roundedSubtotal = Math.ceil(sale.subtotal * 100) / 100;
  const roundedTotalTax = Math.ceil(sale.totalTax * 100) / 100;
  const roundedTransport = Math.ceil(sale.transportCharge * 100) / 100;
  const roundedGrandTotal = Math.ceil(sale.grandTotal * 100) / 100;

  drawText(ctx, `Total Amount: ₹${roundedSubtotal.toFixed(2)}`, summaryX, y);
  y += 14;

  // Calculate CGST and SGST by aggregating from items
  let totalCGST = 0,
    totalSGST = 0,
    totalIGST = 0;
  if (Array.isArray(sale.items)) {
    sale.items.forEach((item) => {
      const taxable = item.sellingPrice * item.qty - (item.discountAmount || 0);
      totalCGST += (taxable * item.cgst) / 100;
      totalSGST += (taxable * item.sgst) / 100;
      totalIGST += (taxable * item.igst) / 100;
    });
  }

  drawText(ctx, `CGST: ₹${Math.ceil(totalCGST * 100) / 100}`, summaryX, y);
  y += 14;

  drawText(ctx, `SGST: ₹${Math.ceil(totalSGST * 100) / 100}`, summaryX, y);
  y += 14;

  if (totalIGST > 0) {
    drawText(ctx, `IGST: ₹${Math.ceil(totalIGST * 100) / 100}`, summaryX, y);
    y += 14;
  }

  drawText(ctx, `Transport: ₹${roundedTransport.toFixed(2)}`, summaryX, y);
  y += 16;

  ctx.font = "bold 12px Arial";
  drawText(ctx, `Grand Total: ₹${roundedGrandTotal.toFixed(2)}`, summaryX, y);

  // ===== BALANCE SECTION =====
  y += 20;
  drawLine(ctx, 20, y, 575, y);
  y += 12;

  ctx.font = "11px Arial";
  ctx.fillStyle = "#000";

  drawText(ctx, "PREVIOUS BALANCE (Opening Balance):", 30, y);
  drawText(ctx, `₹${Number(sale.openingBalance || 0).toFixed(2)}`, 480, y);

  y += 14;
  drawText(ctx, "CURRENT BALANCE (Closing Balance):", 30, y);
  drawText(ctx, `₹${Number(sale.closingBalance || 0).toFixed(2)}`, 480, y);

  // ===== SAMPLE PRODUCTS TABLE =====
  if (sale.sampleItems && Array.isArray(sale.sampleItems) && sale.sampleItems.length > 0) {
    y += 25;
    drawLine(ctx, 20, y, 575, y);
    y += 12;

    ctx.font = "bold 11px Arial";
    ctx.fillStyle = "#1a365d";
    ctx.fillText("SAMPLE PRODUCTS (NOT BILLED)", 30, y);

    y += 14;
    drawLine(ctx, 20, y, 575, y);
    y += 13;

    ctx.font = "bold 10px Arial";
    ctx.fillStyle = "#1a365d";

    // Sample Products Table Header
    drawText(ctx, "Description of Goods", 25, y);
    drawText(ctx, "HSN", 200, y);
    drawText(ctx, "Qty", 305, y);
    drawText(ctx, "Rate", 345, y);
    drawText(ctx, "Total", 500, y);

    // Sample Products Table Body
    y += 12;
    drawLine(ctx, 20, y, 575, y);
    y += 12;

    ctx.font = "10px Arial";
    ctx.fillStyle = "#000";

    sale.sampleItems.forEach((item) => {
      const sampleTotal = item.qty * item.sellingPrice;
      drawText(ctx, item.name.substring(0, 30), 25, y);
      drawText(ctx, item.hsn, 200, y);
      drawText(ctx, item.qty.toString(), 305, y);
      drawText(ctx, `₹${item.sellingPrice.toFixed(2)}`, 345, y);
      drawText(ctx, `₹${sampleTotal.toFixed(2)}`, 500, y);

      // Extra line spacing for description of goods
      y += 25;
    });

    // Sample Products Table Footer
    drawLine(ctx, 20, y, 575, y);
    y += 12;
  }

  // ===== TAX INVOICE SECTION =====
  y += 13;
  drawLine(ctx, 20, y, 575, y);
  y += 12;

  ctx.font = "bold 12px Arial";
  ctx.textAlign = "center";
  ctx.fillText("TAX INVOICE", 297, y);
  ctx.textAlign = "left";

  y += 15;
  drawLine(ctx, 20, y, 575, y);
  y += 12;

  // HSN Table Header
  ctx.font = "bold 10px Arial";
  ctx.fillStyle = "#1a365d";

  drawText(ctx, "HSN Code", 30, y);
  drawText(ctx, "Taxable Value", 120, y);
  drawText(ctx, "CGST (Rate | Amt)", 220, y);
  drawText(ctx, "SGST (Rate | Amt)", 380, y);
  drawText(ctx, "Total", 500, y);

  y += 12;
  drawLine(ctx, 20, y, 575, y);
  y += 11;

  // HSN Table Body
  ctx.font = "10px Arial";
  ctx.fillStyle = "#000";

  hsnArray.forEach((hsnData) => {
    const cgstDisplay = hsnData.cgstRate > 0 ? `${hsnData.cgstRate}% | ₹${hsnData.cgstAmount.toFixed(2)}` : "-";
    const sgstDisplay = hsnData.sgstRate > 0 ? `${hsnData.sgstRate}% | ₹${hsnData.sgstAmount.toFixed(2)}` : "-";

    drawText(ctx, hsnData.hsn, 30, y);
    drawText(ctx, `₹${hsnData.taxableValue.toFixed(2)}`, 120, y);
    drawText(ctx, cgstDisplay, 220, y);
    drawText(ctx, sgstDisplay, 380, y);
    drawText(ctx, `₹${hsnData.total.toFixed(2)}`, 500, y);

    y += 14;
  });

  // HSN Table Footer
  drawLine(ctx, 20, y + 2, 575, y + 2);

  // ===== BACK ORDER INVOICE SECTION =====
  if (sale.backOrderSummary && Array.isArray(sale.backOrderSummary) && sale.backOrderSummary.length > 0) {
    y += 25;
    drawLine(ctx, 20, y, 575, y);
    y += 15;

    ctx.font = "bold 13px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = "#c00";
    ctx.fillText("⚠️ BACK ORDER INVOICE", 297, y);
    ctx.textAlign = "left";
    ctx.fillStyle = "#000";

    y += 18;
    drawLine(ctx, 20, y, 575, y);
    y += 13;

    ctx.font = "bold 10px Arial";
    ctx.fillStyle = "#1a365d";

    // Back Order Table Header
    drawText(ctx, "Description of Goods", 25, y);
    drawText(ctx, "Requested Qty", 250, y);
    drawText(ctx, "Confirmed Qty", 360, y);
    drawText(ctx, "Back Order Qty", 480, y);

    y += 12;
    drawLine(ctx, 20, y, 575, y);
    y += 12;

    ctx.font = "10px Arial";
    ctx.fillStyle = "#000";

    // Back Order Table Body
    sale.backOrderSummary.forEach((backOrder) => {
      drawText(ctx, backOrder.product.substring(0, 28), 25, y);
      drawText(ctx, backOrder.requestedQty.toString(), 250, y);
      drawText(ctx, backOrder.confirmedQty.toString(), 360, y);
      drawText(ctx, backOrder.backOrderQty.toString(), 480, y);

      // Extra line spacing
      y += 25;
    });

    // Back Order Table Footer
    drawLine(ctx, 20, y, 575, y);
    y += 12;

    ctx.font = "11px Arial";
    ctx.fillStyle = "#c00";
    drawText(ctx, "Note: Back order items will be dispatched once stock is available", 30, y);
    y += 12;
    drawText(ctx, "Please contact us for delivery timeline", 30, y);
  }

  // ===== UPLOAD =====
  const buffer = canvas.toBuffer("image/png");

  const upload = await cloudinary.uploader.upload(
    `data:image/png;base64,${buffer.toString("base64")}`,
    {
      folder: "pearls-erp/invoices",
      public_id: `INV_${sale.invoiceId}_${Date.now()}`,
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

  if (Array.isArray(sale.items)) {
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
  }

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
    const { stockAdjustments, invoiceNotes } = req.body;

    const sale = await SalesOrder.findById(req.params.id)
      .populate('salesMan', 'name')
      .populate('deliveryMan', 'name')
      .lean();

    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }

    // ✅ APPLY STOCK ADJUSTMENTS TO ITEMS (for back order handling)
    let adjustedItems = sale.items;
    let backOrderSummary = [];

    if (stockAdjustments && Object.keys(stockAdjustments).length > 0) {
      adjustedItems = sale.items.map((item, idx) => {
        const adjustedQty = stockAdjustments[idx];
        if (adjustedQty !== undefined && adjustedQty !== item.qty) {
          const backOrderQty = item.qty - adjustedQty;
          backOrderSummary.push({
            product: item.name,
            requestedQty: item.qty,
            confirmedQty: adjustedQty,
            backOrderQty: backOrderQty,
          });
          return { ...item, qty: adjustedQty };
        }
        return item;
      });
    }

    // Extract names from populated fields
    sale.salesManName = sale.salesMan?.name || "-";
    sale.deliveryManName = sale.deliveryMan?.name || "-";

    // Fetch customer details including GSTIN
    const customerDoc = await Customer.findById(sale.customer.customerId).select('gstin name').lean();
    if (customerDoc) {
      sale.customer.gstin = customerDoc.gstin || "-";
    }

    // Fetch billing person name (can be SalesOwner, SalesMan, or DeliveryMan)
    let billingPersonName = "-";
    if (sale.billingPerson) {
      // Try to find in SalesOwner first
      let billingPerson = await SalesOwner.findById(sale.billingPerson).select('name').lean();
      if (!billingPerson) {
        // Try SalesMan
        billingPerson = await SalesMan.findById(sale.billingPerson).select('name').lean();
      }
      if (!billingPerson) {
        // Try DeliveryMan
        billingPerson = await DeliveryMan.findById(sale.billingPerson).select('name').lean();
      }
      billingPersonName = billingPerson?.name || "-";
    }
    sale.billingPersonName = billingPersonName;

    // ✅ 1. CHECK STOCK (WAREHOUSE AWARE) - Use adjusted items
    await checkStockAvailability(adjustedItems, sale.warehouse);

    // ✅ 2. GENERATE INVOICE - Use adjusted items
    const invoiceImage = await generateInvoiceImage({ ...sale, items: adjustedItems, backOrderSummary });
    let ewayImage = null;

    if (sale.ewayEnabled) {
      ewayImage = await generateEwayBillImage({ ...sale, items: adjustedItems });
    }

    // ✅ 3. REDUCE STOCK (WAREHOUSE + FIFO) - Use adjusted items
    const lowStockAlerts = await reduceStockFIFO(
      adjustedItems,
      sale.warehouse
    );

    // ✅ 3B. REDUCE STOCK FOR SAMPLE ITEMS
    if (sale.sampleItems && Array.isArray(sale.sampleItems) && sale.sampleItems.length > 0) {
      console.log(`\n📦 Processing ${sale.sampleItems.length} sample items for stock reduction...`);
      await reduceStockFIFO(
        sale.sampleItems,
        sale.warehouse
      );
    }

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
      invoiceNotes: invoiceNotes || "", // Store notes in database
      backOrderSummary: backOrderSummary, // Store back order info
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

    // ✅ 6. WHATSAPP - Include notes and back order info
    const phone = `91${sale.customer.whatsapp}`;
    const customerLoginLink = "https://pearlsfrontend.web.app/customer-login";
    
    // Build message with notes and back order info
    let messageText = `Hello ${sale.customer.name},\n\nInvoice No: ${sale.invoiceId}\nAmount: ₹${sale.grandTotal}\n\n📄 Invoice: ${invoiceImage}\n\n🛒 Pearls Shopping: ${customerLoginLink}`;
    
    // Add back order summary if any
    if (backOrderSummary.length > 0) {
      messageText += `\n\n⚠️ Back Order Items:`;
      backOrderSummary.forEach(bo => {
        messageText += `\n• ${bo.product}: ${bo.backOrderQty} qty deferred`;
      });
    }
    
    // Add billing notes if provided
    if (invoiceNotes && invoiceNotes.trim()) {
      messageText += `\n\n📝 Notes: ${invoiceNotes}`;
    }

    const message = encodeURIComponent(messageText);

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