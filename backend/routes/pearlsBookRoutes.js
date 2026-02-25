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
// Helper function to ensure items have pricing information
async function enrichItemsWithPrices(items, isPurchase = false) {
  if (!Array.isArray(items)) return [];
  
  return await Promise.all(items.map(async (item) => {
    // If price is already set and non-zero, use it
    if (isPurchase && item.purchasePrice && item.purchasePrice > 0) {
      return item;
    }
    if (!isPurchase && item.sellingPrice && item.sellingPrice > 0) {
      return item;
    }
    
    // If price is missing, try to fetch from Product model
    if (item.productId) {
      try {
        const product = await Product.findById(item.productId).lean();
        if (product) {
          if (isPurchase && !item.purchasePrice) {
            item.purchasePrice = product.purchasePrice || 0;
          } else if (!isPurchase && !item.sellingPrice) {
            item.sellingPrice = product.sellingPrice || 0;
          }
        }
      } catch (err) {
        console.log(`Could not fetch product prices for ${item.productId}`);
      }
    }
    
    return item;
  }));
}

router.get("/", async (req, res) => {
  try {
    const purchases = await PurchaseOrder.find().lean();
    const sales = await SalesOrder.find().lean();

    const purchaseMapped = await Promise.all(purchases.map(async (p) => ({
      _id: p._id,
      type: "PURCHASE",
      date: p.date,
      invoiceId: p.invoiceId,
      party: p.vendor,
      warehouse: p.warehouse,
      items: await enrichItemsWithPrices(p.items, true),
      subtotal: p.subtotal,
      totalTax: p.totalTax,
      transportCharge: p.transportCharge || 0,
      grandTotal: p.grandTotal,
    })));

    const salesMapped = [];
    
    for (const s of sales) {
      // Always create a SALES ORDER row with original items
      // Note: Sales order doesn't affect the closing balance, only the opening balance is used
      const salesOrderRow = {
        _id: s._id,
        type: "SALES ORDER",
        recordId: `${s._id}-SO`,
        date: s.createdAt,
        invoiceId: s.invoiceId,
        party: s.customer?.name || "",
        warehouse: s.warehouse,
        openingBalance: s.openingBalance,
        closingBalance: s.openingBalance, // Sales order doesn't affect balance
        items: await enrichItemsWithPrices(s.items, false),
        sampleItems: await enrichItemsWithPrices(s.sampleItems, false),
        subtotal: s.subtotal,
        totalTax: s.totalTax,
        transportCharge: s.transportCharge,
        grandTotal: s.grandTotal,
        invoiceGenerated: s.invoiceGenerated || false,
      };
      salesMapped.push(salesOrderRow);

      // If invoice was generated, create a separate SALES INVOICE row with invoice items
      if (s.invoiceGenerated) {
        // Calculate closing balance based on invoice amount only
        const invoiceAmount = s.invoiceGrandTotal || s.grandTotal;
        const invoiceOpeningBalance = s.openingBalance || 0;
        const invoiceClosingBalance = invoiceOpeningBalance + invoiceAmount;

        const salesInvoiceRow = {
          _id: s._id,
          type: "SALES INVOICE",
          recordId: `${s._id}-SI`,
          date: s.invoiceDate || s.createdAt,
          invoiceId: s.invoiceId,
          party: s.customer?.name || "",
          warehouse: s.warehouse,
          openingBalance: invoiceOpeningBalance,
          closingBalance: invoiceClosingBalance,
          // Use invoice items if they exist, otherwise fall back to original items
          items: await enrichItemsWithPrices(s.invoiceItems || s.items, false),
          sampleItems: await enrichItemsWithPrices(s.invoiceSampleItems || s.sampleItems, false),
          subtotal: s.invoiceSubtotal || s.subtotal,
          totalTax: s.invoiceTotalTax || s.totalTax,
          transportCharge: s.invoiceTransportCharge || s.transportCharge,
          grandTotal: invoiceAmount,
          invoiceGenerated: true,
        };
        salesMapped.push(salesInvoiceRow);
      }
    }

    const merged = [...purchaseMapped, ...salesMapped].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    res.json(merged);
  } catch (err) {
    console.error("Pearls Book GET error:", err);
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
  const estimatedHeight = 250 + (sale.items?.length || 0) * 18 + totalHsnItems * 20 + 400;

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

      y += 16;
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

      y += 16;
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

router.post("/generate-invoice-preview/:id", async (req, res) => {
  try {
    const { stockAdjustments = {}, invoiceNotes = "" } = req.body;
    
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

    // ✅ 1. CREATE ADJUSTED ITEMS FOR INVOICE (SALES INVOICE record)
    const invoicedItems = sale.items.map((item, idx) => {
      const adjustedQty = stockAdjustments[idx] !== undefined ? stockAdjustments[idx] : item.qty;
      return {
        ...item,
        qty: adjustedQty,
        total: adjustedQty * item.sellingPrice - (item.discountAmount || 0),
      };
    });

    // Calculate back order summary
    const backOrderSummary = sale.items.map((item, idx) => {
      const requestedQty = item.qty;
      const confirmedQty = stockAdjustments[idx] !== undefined ? stockAdjustments[idx] : item.qty;
      const backOrderQty = Math.max(0, requestedQty - confirmedQty);

      return {
        product: item.name,
        requestedQty,
        confirmedQty,
        backOrderQty,
      };
    }).filter(b => b.backOrderQty > 0);

    // Calculate updated totals for invoice
    let newSubtotal = 0;
    let newTotalTax = 0;
    invoicedItems.forEach(item => {
      const qty = item.qty;
      const baseAmount = item.sellingPrice * qty;
      newSubtotal += baseAmount;
      const taxable = baseAmount - (item.discountAmount || 0);
      newTotalTax += (taxable * item.gst) / 100;
    });

    const newGrandTotal = newSubtotal + newTotalTax + (sale.transportCharge || 0);

    // ✅ 2. CHECK STOCK (WAREHOUSE AWARE)
    await checkStockAvailability(invoicedItems, sale.warehouse);

    // ✅ 3. GENERATE INVOICE (with adjusted items)
    const invoiceData = {
      ...sale,
      items: invoicedItems,
      subtotal: newSubtotal,
      totalTax: newTotalTax,
      grandTotal: newGrandTotal,
      invoiceNotes: invoiceNotes,
      backOrderSummary: backOrderSummary,
    };

    const invoiceImage = await generateInvoiceImage(invoiceData);
    let ewayImage = null;

    if (sale.ewayEnabled) {
      ewayImage = await generateEwayBillImage(invoiceData);
    }

    // ✅ Store adjustments for later confirmation
    const phone = `91${sale.customer.whatsapp}`;
    const customerLoginLink = "https://pearlsfrontend.web.app/customer-login";
    const message = encodeURIComponent(
      `Hello ${sale.customer.name},\n\nInvoice No: ${sale.invoiceId}\nAmount: ₹${newGrandTotal}\n\n📄 Invoice: ${invoiceImage}\n\n🛒 Pearls Shopping: ${customerLoginLink}`
    );

    res.json({
      success: true,
      invoiceImage,
      ewayImage,
      waUrl: `https://wa.me/${phone}?text=${message}`,
      stockAdjustments, // Send back to frontend for confirmation
      invoiceNotes,
    });
  } catch (err) {
    console.error("INVOICE PREVIEW ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ NEW ENDPOINT: Confirm invoice and perform all actions (reduce stock, update balance, create commissions)
router.post("/confirm-invoice/:id", async (req, res) => {
  try {
    const { stockAdjustments = {}, invoiceNotes = "" } = req.body;
    
    const sale = await SalesOrder.findById(req.params.id)
      .populate('salesMan', 'name')
      .populate('deliveryMan', 'name')
      .lean();

    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }

    // ✅ 1. CREATE ADJUSTED ITEMS FOR INVOICE
    const invoicedItems = sale.items.map((item, idx) => {
      const adjustedQty = stockAdjustments[idx] !== undefined ? stockAdjustments[idx] : item.qty;
      return {
        ...item,
        qty: adjustedQty,
        total: adjustedQty * item.sellingPrice - (item.discountAmount || 0),
      };
    });

    // Create adjusted sample items
    const invoicedSampleItems = sale.sampleItems.map((item, idx) => ({
      ...item,
      qty: item.qty, // Sample items typically don't change, but keep the option
    }));

    // Calculate back order summary
    const backOrderSummary = sale.items.map((item, idx) => {
      const requestedQty = item.qty;
      const confirmedQty = stockAdjustments[idx] !== undefined ? stockAdjustments[idx] : item.qty;
      const backOrderQty = Math.max(0, requestedQty - confirmedQty);

      return {
        product: item.name,
        requestedQty,
        confirmedQty,
        backOrderQty,
      };
    }).filter(b => b.backOrderQty > 0);

    // Calculate updated totals
    let newSubtotal = 0;
    let newTotalTax = 0;
    invoicedItems.forEach(item => {
      const qty = item.qty;
      const baseAmount = item.sellingPrice * qty;
      newSubtotal += baseAmount;
      const taxable = baseAmount - (item.discountAmount || 0);
      newTotalTax += (taxable * item.gst) / 100;
    });

    const newGrandTotal = newSubtotal + newTotalTax + (sale.transportCharge || 0);

    // ✅ 2. REDUCE STOCK (WAREHOUSE + FIFO) - using invoiced items
    const lowStockAlerts = await reduceStockFIFO(invoicedItems, sale.warehouse);

    // ✅ 3. REDUCE STOCK FOR SAMPLE ITEMS
    if (sale.sampleItems && Array.isArray(sale.sampleItems) && sale.sampleItems.length > 0) {
      console.log(`\n📦 Processing ${sale.sampleItems.length} sample items for stock reduction...`);
      await reduceStockFIFO(sale.sampleItems, sale.warehouse);
    }

    // ✅ 4. UPDATE CUSTOMER BALANCE
    const invoiceAmount = newGrandTotal;
    const customer = await Customer.findById(sale.customer.customerId);

    if (!customer) {
      throw new Error("Customer not found");
    }

    // Invoice opening balance is the current customer closing balance
    const invoiceOpeningBalance = customer.closingBalance;
    const invoiceClosingBalance = invoiceOpeningBalance + invoiceAmount;

    // Update customer's actual closing balance
    await Customer.findByIdAndUpdate(sale.customer.customerId, {
      closingBalance: invoiceClosingBalance,
      totalBalance: invoiceClosingBalance,
    });

    // ✅ 5. UPDATE ORIGINAL SALES ORDER WITH INVOICE DETAILS (KEEP ORIGINAL ITEMS)
    // Save adjusted items in invoiceItems field, keep original items unchanged
    const updatedSale = await SalesOrder.findByIdAndUpdate(req.params.id, {
      invoiceItems: invoicedItems,
      invoiceSampleItems: invoicedSampleItems,
      invoiceSubtotal: newSubtotal,
      invoiceTotalTax: newTotalTax,
      invoiceGrandTotal: newGrandTotal,
      invoiceTransportCharge: sale.transportCharge || 0,
      invoiceOpeningBalance: invoiceOpeningBalance,
      invoiceClosingBalance: invoiceClosingBalance,
      invoiceNotes: invoiceNotes,
      backOrderSummary: backOrderSummary,
      invoiceGenerated: true,
    }, { new: true });

    console.log(`✅ SALES INVOICE updated: ${updatedSale._id}`);

    console.log(`✅ Customer balance updated: ₹${invoiceOpeningBalance} → ₹${invoiceClosingBalance}`);

    // ✅ 6. CREATE COMMISSIONS
    try {
      const salesOwnerDoc = sale.salesOwner ? await SalesOwner.findById(sale.salesOwner) : null;
      const salesManDoc = sale.salesMan ? await SalesMan.findById(sale.salesMan) : null;
      const deliveryManDoc = sale.deliveryMan ? await DeliveryMan.findById(sale.deliveryMan) : null;

      const getCommission = async (personId, roleType) => {
        if (!personId) return { percentage: 0, amount: 0 };
        
        const rule = await CommissionRule.findOne({
          personId: personId,
          roleType: roleType,
          minimumOrderValue: { $lte: invoiceAmount },
          isActive: true,
        }).sort({ minimumOrderValue: -1 });
        
        if (!rule) return { percentage: 0, amount: 0 };
        
        const commissionAmount = (invoiceAmount * rule.commissionPercentage) / 100;
        return { percentage: rule.commissionPercentage, amount: commissionAmount };
      };

      const soCommission = await getCommission(sale.salesOwner, "SalesOwner");
      const smCommission = await getCommission(sale.salesMan, "SalesMan");
      const dmCommission = await getCommission(sale.deliveryMan, "DeliveryMan");

      const commissionData = {
        salesOrderId: req.params.id,
        orderValue: invoiceAmount,
        invoiceId: sale.invoiceId,
        salesOwnerId: salesOwnerDoc?._id,
        salesOwnerName: salesOwnerDoc?.name,
        salesOwnerCommissionPercentage: soCommission.percentage,
        salesOwnerCommissionAmount: soCommission.amount,
        salesManId: salesManDoc?._id,
        salesManName: salesManDoc?.name,
        salesManCommissionPercentage: smCommission.percentage,
        salesManCommissionAmount: smCommission.amount,
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

    res.json({
      success: true,
      message: "Invoice confirmed and all actions completed",
      lowStockAlerts,
    });
  } catch (err) {
    console.error("INVOICE CONFIRM ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// Keep old endpoint for backward compatibility (now just calls preview)
router.post("/generate-invoice/:id", async (req, res) => {
  try {
    const { stockAdjustments = {}, invoiceNotes = "" } = req.body;
    
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

    // Fetch customer details including GSTIN
    const customerDoc = await Customer.findById(sale.customer.customerId).select('gstin name').lean();
    if (customerDoc) {
      sale.customer.gstin = customerDoc.gstin || "-";
    }

    // Fetch billing person name
    let billingPersonName = "-";
    if (sale.billingPerson) {
      let billingPerson = await SalesOwner.findById(sale.billingPerson).select('name').lean();
      if (!billingPerson) {
        billingPerson = await SalesMan.findById(sale.billingPerson).select('name').lean();
      }
      if (!billingPerson) {
        billingPerson = await DeliveryMan.findById(sale.billingPerson).select('name').lean();
      }
      billingPersonName = billingPerson?.name || "-";
    }
    sale.billingPersonName = billingPersonName;

    // ✅ 1. CREATE ADJUSTED ITEMS FOR INVOICE
    const invoicedItems = sale.items.map((item, idx) => {
      const adjustedQty = stockAdjustments[idx] !== undefined ? stockAdjustments[idx] : item.qty;
      return {
        ...item,
        qty: adjustedQty,
        total: adjustedQty * item.sellingPrice - (item.discountAmount || 0),
      };
    });

    // Calculate back order summary
    const backOrderSummary = sale.items.map((item, idx) => {
      const requestedQty = item.qty;
      const confirmedQty = stockAdjustments[idx] !== undefined ? stockAdjustments[idx] : item.qty;
      const backOrderQty = Math.max(0, requestedQty - confirmedQty);

      return {
        product: item.name,
        requestedQty,
        confirmedQty,
        backOrderQty,
      };
    }).filter(b => b.backOrderQty > 0);

    // Calculate updated totals for invoice
    let newSubtotal = 0;
    let newTotalTax = 0;
    invoicedItems.forEach(item => {
      const qty = item.qty;
      const baseAmount = item.sellingPrice * qty;
      newSubtotal += baseAmount;
      const taxable = baseAmount - (item.discountAmount || 0);
      newTotalTax += (taxable * item.gst) / 100;
    });

    const newGrandTotal = newSubtotal + newTotalTax + (sale.transportCharge || 0);

    // ✅ 2. CHECK STOCK
    await checkStockAvailability(invoicedItems, sale.warehouse);

    // ✅ 3. GENERATE INVOICE
    const invoiceData = {
      ...sale,
      items: invoicedItems,
      subtotal: newSubtotal,
      totalTax: newTotalTax,
      grandTotal: newGrandTotal,
      invoiceNotes: invoiceNotes,
      backOrderSummary: backOrderSummary,
    };

    const invoiceImage = await generateInvoiceImage(invoiceData);
    let ewayImage = null;

    if (sale.ewayEnabled) {
      ewayImage = await generateEwayBillImage(invoiceData);
    }

    // ✅ WHATSAPP
    const phone = `91${sale.customer.whatsapp}`;
    const customerLoginLink = "https://pearlsfrontend.web.app/customer-login";
    const message = encodeURIComponent(
      `Hello ${sale.customer.name},\n\nInvoice No: ${sale.invoiceId}\nAmount: ₹${newGrandTotal}\n\n📄 Invoice: ${invoiceImage}\n\n🛒 Pearls Shopping: ${customerLoginLink}`
    );

    res.json({
      success: true,
      invoiceImage,
      ewayImage,
      waUrl: `https://wa.me/${phone}?text=${message}`,
    });
  } catch (err) {
    console.error("INVOICE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

export default router;