import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import cloudinary from "../config/cloudinary.js";
import Branch from "../models/Branch.js";
import CreditNote from "../models/CreditNote.js";
import Customer from "../models/Customer.js";
import DeliveryMan from "../models/DeliveryMan.js";
import Invoice from "../models/Invoice.js";
import Product from "../models/Product.js";
import SalesMan from "../models/SalesMan.js";
import SalesOrder from "../models/SalesOrder.js";
import SalesOwner from "../models/SalesOwner.js";
import VoucherType from "../models/VoucherType.js";
import { getFinancialYear } from "../utils/financialYear.js";
import { createAuditLog } from "../utils/logUtil.js";


const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// GET sales order for invoice generation (shows pending items for back order calculation)
router.get("/prepare/:salesOrderId", async (req, res) => {
  try {
    const { salesOrderId } = req.params;

    const salesOrder = await SalesOrder.findById(salesOrderId)
      .populate("branchId")
      .populate("customer.customerId");

    if (!salesOrder) {
      return res.status(404).json({ message: "Sales order not found" });
    }

    // Calculate back order info
    const backOrderItems = salesOrder.items.map((item) => ({
      ...item.toObject(),
      originalQty: item.qty,
      confirmedQty: item.qty, // Default to full qty
      backOrderQty: 0,
    }));

    res.json({
      salesOrder,
      backOrderItems,
      financialYear: getFinancialYear(),
    });
  } catch (error) {
    console.error("Error preparing invoice:", error);
    res.status(500).json({ message: "Failed to prepare invoice" });
  }
});

// POST - Generate Invoice Preview (shows before finalizing)
router.post("/preview/:salesOrderId", async (req, res) => {
  try {
    const { salesOrderId } = req.params;
    const {
      items,
      notes,
      invoiceType = "ORDER_DETAILS",
      commonDiscount: customCommonDiscount,
      transportCharge: customTransportCharge,
      transportGstPercent: customTransportGstPercent,
      extraExpenseAmount: customExtraExpenseAmount,
      finalizedBy,
      finalizedByUsername
    } = req.body;

    const salesOrder = await SalesOrder.findById(salesOrderId)
      .populate("branchId")
      .populate("customer.customerId");

    if (!salesOrder) {
      return res.status(404).json({ message: "Sales order not found" });
    }

    let grossSubtotal = 0;
    let totalTaxAmount = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;

    const recalculatedItems = items.map((item) => {
      const originalItem = salesOrder.items.find(
        (so) => so._id.toString() === item._id
      );

      const confirmedQty = Number(item.confirmedQty || item.qty || 0);
      const sellingPrice = Number(item.sellingPrice || (originalItem ? originalItem.sellingPrice : 0));
      const gstPercent = Number(item.gst || (originalItem ? originalItem.gst : 0));
      const cgstPercent = Number(item.cgst || (originalItem ? originalItem.cgst : 0));
      const sgstPercent = Number(item.sgst || (originalItem ? originalItem.sgst : 0));
      const igstPercent = Number(item.igst || (originalItem ? originalItem.igst : 0));
      const discountPercent = Number(item.discountPercent || 0);
      const discountAmount = Number(item.discountAmount || 0);

      // 1. Calculate Taxable Amount (subtracting product-level discount)
      const grossAmount = sellingPrice * confirmedQty;
      const taxableAmount = Math.round((grossAmount - discountAmount) * 100) / 100;

      // 2. Calculate GST components
      const cgstAmount = Math.round((taxableAmount * cgstPercent / 100) * 100) / 100;
      const sgstAmount = Math.round((taxableAmount * sgstPercent / 100) * 100) / 100;
      const igstAmount = Math.round((taxableAmount * igstPercent / 100) * 100) / 100;
      const totalGST = cgstAmount + sgstAmount + igstAmount;

      // 3. Item total (Inclusive)
      const itemTotalWithTax = taxableAmount + totalGST;

      // Update global totals
      grossSubtotal += taxableAmount;
      cgstTotal += cgstAmount;
      sgstTotal += sgstAmount;
      igstTotal += igstAmount;
      totalTaxAmount += totalGST;

      return {
        ...(originalItem ? originalItem.toObject() : item),
        qty: confirmedQty,
        sellingPrice: sellingPrice,
        discountPercent,
        discountAmount,
        total: itemTotalWithTax,
        gst: gstPercent,
        cgst: cgstPercent,
        sgst: sgstPercent,
        igst: igstPercent,
        hsn: item.hsn || (originalItem ? originalItem.hsn : "")
      };
    });

    const backOrderItems = items
      .filter((item) => item.backOrderQty > 0)
      .map((item) => ({
        ...item,
        qty: item.backOrderQty,
      }));

    // Transport GST calculation
    const commonDiscount = customCommonDiscount !== undefined
      ? Number(customCommonDiscount)
      : (salesOrder.commonDiscount || 0);

    const tCharge = customTransportCharge !== undefined
      ? Number(customTransportCharge)
      : (salesOrder.transportCharge || 0);

    const extraExpenseAmount = customExtraExpenseAmount !== undefined
      ? Number(customExtraExpenseAmount)
      : (salesOrder.extraExpenseAmount || 0);

    const tGstPercent = customTransportGstPercent !== undefined
      ? Number(customTransportGstPercent)
      : (salesOrder.transportGstPercent || 0);
    const tGstAmount = Math.round((tCharge * tGstPercent / 100) * 100) / 100;

    const totalTax = {
      cgst: Math.round((cgstTotal + (igstTotal === 0 ? tGstAmount / 2 : 0)) * 100) / 100,
      sgst: Math.round((sgstTotal + (igstTotal === 0 ? tGstAmount / 2 : 0)) * 100) / 100,
      igst: Math.round((igstTotal + (igstTotal > 0 ? tGstAmount : 0)) * 100) / 100,
    };
    totalTax.total = Math.round((totalTax.cgst + totalTax.sgst + totalTax.igst) * 100) / 100;

    // Calculate precise total before rounding
    const preciseGrandTotal = grossSubtotal + totalTax.total + extraExpenseAmount + tCharge - commonDiscount;
    const grandTotal = Math.round(preciseGrandTotal);
    const roundingOff = Math.round((grandTotal - preciseGrandTotal) * 100) / 100;

    // Fetch billing person name
    let billingPersonName = "-";
    if (salesOrder.billingPerson) {
      if (mongoose.Types.ObjectId.isValid(salesOrder.billingPerson)) {
        let billingPerson = await SalesOwner.findById(salesOrder.billingPerson).select('name').lean();
        if (!billingPerson) {
          billingPerson = await SalesMan.findById(salesOrder.billingPerson).select('name').lean();
        }
        if (!billingPerson) {
          billingPerson = await DeliveryMan.findById(salesOrder.billingPerson).select('name').lean();
        }
        billingPersonName = billingPerson?.name || "-";
      } else {
        // If it's not a valid ObjectId, it's likely already a name string (e.g., "System Administrator")
        billingPersonName = salesOrder.billingPerson;
      }
    }

    // Fetch delivery man name
    let deliveryManName = "-";
    if (salesOrder.deliveryMan) {
      if (mongoose.Types.ObjectId.isValid(salesOrder.deliveryMan)) {
        const dMan = await DeliveryMan.findById(salesOrder.deliveryMan).select('name').lean();
        deliveryManName = dMan?.name || "-";
      } else {
        deliveryManName = salesOrder.deliveryMan;
      }
    }

    // Dynamic balance calculation based on requested customer
    const bodyCustomerId = req.body.customerId;
    let customerToUse = salesOrder.customer?.customerId;
    let isCustomerSwapped = false;

    if (bodyCustomerId && bodyCustomerId !== customerToUse?._id?.toString()) {
      customerToUse = await Customer.findById(bodyCustomerId).lean();
      isCustomerSwapped = true;
    }

    let dynamicOpeningBalance = 0;
    let closingBalance = 0;

    if (customerToUse) {
      // 1. Get Live Balance of the target customer
      const currentBalance = (customerToUse.debit || 0) - (customerToUse.credit || 0);

      // 2. Already applied amount for THIS order (if re-editing)
      const balanceAdjustment = salesOrder.invoiceGenerated ? (salesOrder.lastInvoicedGrandTotal || 0) : 0;

      // Opening Balance = Balance BEFORE this specific bill was added
      dynamicOpeningBalance = currentBalance - balanceAdjustment;

      // Closing Balance = Balance AFTER applying the new grandTotal
      closingBalance = dynamicOpeningBalance + grandTotal;
    } else {
      dynamicOpeningBalance = salesOrder.openingBalance || 0;
      closingBalance = dynamicOpeningBalance + grandTotal;
    }

    const formatBalance = (val) => {
      const absVal = Math.abs(val).toFixed(2);
      return val >= 0 ? `₹${absVal} Dr` : `₹${absVal} Cr`;
    };

    const previewData = {
      invoiceNumber: salesOrder.invoiceId,
      salesOrderId,
      billingPerson: billingPersonName,
      deliveryMan: deliveryManName,
      customer: isCustomerSwapped ? {
        customerId: customerToUse._id,
        name: customerToUse.name,
        whatsapp: customerToUse.whatsapp,
        address: customerToUse.address,
        district: customerToUse.district,
        state: customerToUse.state,
        stateCode: customerToUse.stateCode,
        pincode: customerToUse.pincode,
        gstin: customerToUse.gstin,
      } : salesOrder.customer,
      seller: {
        name: salesOrder.branchId?.name || "PEARL AGENCY",
        address: salesOrder.branchId?.address || "12/13, South By-Pass Road, Vanarpettai, Tirunelveli - 627003",
        state: salesOrder.branchId?.state || "Tamil Nadu",
        pincode: salesOrder.branchId?.pincode || "627003",
        gstin: salesOrder.branchId?.gstin || "33DULPS2600Q1Z6",
        phone: salesOrder.branchId?.phone || "9429692970",
        gpayNo: salesOrder.branchId?.gpayNo || "",
        upiId: salesOrder.branchId?.upiId || "",
        stateCode: salesOrder.branchId?.stateCode || "33",
        logo: salesOrder.branchId?.logo || "/logo.jpeg",
      },
      items: recalculatedItems,
      backOrderItems,
      sampleItems: salesOrder.sampleItems || [],
      subtotal: grossSubtotal,
      totalDiscount: 0,
      totalTax,
      transportCharge: tCharge,
      transportGstPercent: tGstPercent,
      transportGstAmount: tGstAmount,
      extraExpenses: salesOrder.extraExpenses || [],
      extraExpenseAmount: extraExpenseAmount,
      commonDiscount: commonDiscount,
      grandTotal: grandTotal,
      roundingOff: roundingOff,
      openingBalance: dynamicOpeningBalance,
      closingBalance: closingBalance,
      formattedOpeningBalance: formatBalance(dynamicOpeningBalance),
      formattedClosingBalance: formatBalance(closingBalance),
      notes,
      invoiceType,
      invoiceDate: salesOrder.orderDate || salesOrder.createdAt || new Date(),
    };

    res.json(previewData);
  } catch (error) {
    console.error("Error generating preview:", error);
    res.status(500).json({ message: "Failed to generate preview" });
  }
});

// POST - Finalize Invoice (save and generate)
router.post("/finalize/:salesOrderId", async (req, res) => {
  try {
    const { salesOrderId } = req.params;
    const {
      items,
      notes,
      invoiceType = "ORDER_DETAILS",
      commonDiscount: customCommonDiscount,
      transportCharge: customTransportCharge,
      transportGstPercent: customTransportGstPercent,
      extraExpenseAmount: customExtraExpenseAmount,
      finalizedBy,
      finalizedByUsername
    } = req.body;

    let retries = 3;
    let finalizeSuccess = false;
    let lastError = null;

    while (retries > 0 && !finalizeSuccess) {
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const salesOrder = await SalesOrder.findById(salesOrderId).session(session);

        if (!salesOrder) {
          await session.abortTransaction();
          session.endSession();
          return res.status(404).json({ message: "Sales order not found" });
        }

        const branch = await Branch.findById(salesOrder.branchId).session(session);

        // 🔄 Use swapped customer if provided in body, else fallback to SO customer
        const bodyCustomerId = req.body.customerId;
        let customerIdToUse = bodyCustomerId || salesOrder.customer?.customerId;
        const customer = await Customer.findById(customerIdToUse).session(session);

        if (!customer) {
          await session.abortTransaction();
          session.endSession();
          return res.status(404).json({ message: "Customer not found" });
        }

        const isCustomerSwapped = customer._id.toString() !== salesOrder.customer?.customerId?.toString();
        const lastCustomerId = salesOrder.lastInvoicedCustomerId || salesOrder.customer?.customerId;
        const lastGrandTotal = salesOrder.lastInvoicedGrandTotal || 0;
        const financialYear = getFinancialYear();

        // ==========================================
        // 1️⃣ GENERATE OR REUSE INVOICE NUMBER
        // ==========================================
        let invoice = await Invoice.findOne({ salesOrderId: salesOrder._id }).session(session);
        let invoiceNumber;

        if (invoice) {
          invoiceNumber = invoice.invoiceNumber;
        } else {
          // Generate NEW sequential SI number
          const rawSoId = salesOrder.invoiceId || "";
          const cleanSoId = rawSoId.replace(/^(SO|SO REF|SO\sREF)[:\s\-]*/i, "");
          const soPrefixPrefix = cleanSoId.split('/')[0];
          let siPrefix = soPrefixPrefix.endsWith("SO") ? soPrefixPrefix.replace(/SO$/i, "SI") : `${soPrefixPrefix}SI`;

          let siVoucher = await VoucherType.findOne({
            branchId: salesOrder.branchId,
            prefix: siPrefix,
            orderType: "SI",
            financialYear
          }).session(session);

          if (!siVoucher) {
            siVoucher = new VoucherType({
              branchId: salesOrder.branchId,
              name: soPrefixPrefix.toLowerCase().replace(/so$/i, ""),
              orderType: "SI",
              prefix: siPrefix,
              counter: 1,
              financialYear
            });
            await siVoucher.save({ session });
          }

          const existingInvoices = await Invoice.find({
            branchId: salesOrder.branchId,
            invoiceNumber: new RegExp(`^${siPrefix}/`),
            financialYear
          }).select('invoiceNumber').session(session).lean();

          let highestNumInDB = 0;
          existingInvoices.forEach(inv => {
            const parts = inv.invoiceNumber.split('/');
            if (parts.length >= 2) {
              const num = parseInt(parts[1]);
              if (!isNaN(num) && num > highestNumInDB) highestNumInDB = num;
            }
          });

          const nextNum = Math.max(siVoucher.counter, highestNumInDB + 1);
          invoiceNumber = `${siVoucher.prefix}/${String(nextNum).padStart(3, "0")}/${financialYear}`;
          siVoucher.counter = nextNum + 1;
          await siVoucher.save({ session });
        }

        // ==========================================
        // 2️⃣ PROCESS ITEMS & CALCULATE TOTALS
        // ==========================================
        const processedItems = items.map((item) => {
          const originalItem = salesOrder.items.find(so => so._id.toString() === item._id);
          const confirmedQty = Number(item.confirmedQty || item.qty || 0);
          const originalQty = Number(item.originalQty || (originalItem ? originalItem.qty : confirmedQty));
          const backOrderQty = Number(item.backOrderQty || Math.max(0, originalQty - confirmedQty));
          const sellingPrice = Number(item.sellingPrice || (originalItem ? originalItem.sellingPrice : 0));
          const gstPercent = Number(item.gst || (originalItem ? originalItem.gst : 0));
          const discountPercent = Number(item.discountPercent || 0);
          const discountAmount = Number(item.discountAmount || 0);

          const coreFields = {
            originalQty,
            confirmedQty,
            backOrderQty,
            discountPercent,
            discountAmount,
            sellingPrice,
            gst: gstPercent,
            name: item.name || (originalItem ? originalItem.name : "Unknown Product"),
            hsn: item.hsn || (originalItem ? originalItem.hsn : "")
          };

          if (originalItem) {
            const qtyRatio = confirmedQty / originalItem.qty;
            return {
              ...originalItem.toObject(),
              ...coreFields,
              qty: confirmedQty,
              altQty: originalItem.altQty ? Math.round(originalItem.altQty * qtyRatio) : 0,
              total: Math.round(originalItem.total * qtyRatio * 100) / 100,
            };
          } else {
            const itemGrossAmount = Math.round(sellingPrice * confirmedQty * 100) / 100;
            const itemTotalWithTax = item.total || Math.round(itemGrossAmount * (1 + gstPercent / 100) * 100) / 100;
            return {
              ...item,
              ...coreFields,
              qty: confirmedQty,
              sellingPrice,
              total: itemTotalWithTax
            };
          }
        });

        // 🧮 Calculate Totals
        let grossSubtotal = 0;
        let cgstTotal = 0, sgstTotal = 0, igstTotal = 0;

        processedItems.forEach((item) => {
          const grossAmount = (item.sellingPrice || 0) * (item.qty || 0);
          const taxableAmount = Math.round((grossAmount - (item.discountAmount || 0)) * 100) / 100;
          const cgstAmt = Math.round((taxableAmount * (item.cgst || 0) / 100) * 100) / 100;
          const sgstAmt = Math.round((taxableAmount * (item.sgst || 0) / 100) * 100) / 100;
          const igstAmt = Math.round((taxableAmount * (item.igst || 0) / 100) * 100) / 100;

          grossSubtotal += taxableAmount;
          cgstTotal += cgstAmt;
          sgstTotal += sgstAmt;
          igstTotal += igstAmt;

          // Ensure item total is synced with fresh counts
          item.total = Math.round((taxableAmount + cgstAmt + sgstAmt + igstAmt) * 100) / 100;
        });

        const commonDiscount = customCommonDiscount !== undefined ? Number(customCommonDiscount) : (salesOrder.commonDiscount || 0);
        const tCharge = customTransportCharge !== undefined ? Number(customTransportCharge) : (salesOrder.transportCharge || 0);
        const extraExpenseAmount = customExtraExpenseAmount !== undefined ? Number(customExtraExpenseAmount) : (salesOrder.extraExpenseAmount || 0);
        
        const tGstPercent = customTransportGstPercent !== undefined 
          ? Number(customTransportGstPercent) 
          : (salesOrder.transportGstPercent || 0);
        const tGstAmount = Math.round((tCharge * tGstPercent / 100) * 100) / 100;
        const totalTax = {
          cgst: Math.round((cgstTotal + (igstTotal === 0 ? tGstAmount / 2 : 0)) * 100) / 100,
          sgst: Math.round((sgstTotal + (igstTotal === 0 ? tGstAmount / 2 : 0)) * 100) / 100,
          igst: Math.round((igstTotal + (igstTotal > 0 ? tGstAmount : 0)) * 100) / 100,
        };
        totalTax.total = Math.round((totalTax.cgst + totalTax.sgst + totalTax.igst) * 100) / 100;

        const preciseGrandTotal = grossSubtotal + totalTax.total + extraExpenseAmount + tCharge - commonDiscount;
        const grandTotal = Math.round(preciseGrandTotal);
        const roundingOff = Math.round((grandTotal - preciseGrandTotal) * 100) / 100;

        // ==========================================
        // 3️⃣ UPDATE STOCK (DELTA-BASED)
        // ==========================================
        const lastItems = salesOrder.lastInvoicedItems || [];
        const allProductIds = new Set([
          ...processedItems.map(i => i.productId.toString()),
          ...lastItems.map(i => i.productId.toString())
        ]);

        for (const pId of allProductIds) {
          const newItem = processedItems.find(i => i.productId.toString() === pId);
          const oldItem = lastItems.find(i => i.productId.toString() === pId);
          const deltaQty = (newItem?.qty || 0) - (oldItem?.qty || 0);
          if (deltaQty !== 0) {
            await Product.updateOne({ _id: pId }, { $inc: { totalQty: -deltaQty } }, { session });
          }
        }

        // ==========================================
        // 4️⃣ UPDATE CUSTOMER BALANCE (SINGLE-PASS)
        // ==========================================
        if (isCustomerSwapped && salesOrder.invoiceGenerated) {
          // A. Revert old customer
          const oldCustomer = await Customer.findById(lastCustomerId).session(session);
          if (oldCustomer) {
            let remaining = lastGrandTotal;
            let d = oldCustomer.debit || 0, c = oldCustomer.credit || 0;
            if (d >= remaining) d -= remaining;
            else { remaining -= d; d = 0; c += remaining; }
            oldCustomer.debit = Math.round(d); oldCustomer.credit = Math.round(c);
            oldCustomer.closingBalance = Math.round((oldCustomer.closingBalance || 0) - lastGrandTotal);
            oldCustomer.totalBalance = oldCustomer.closingBalance;
            await oldCustomer.save({ session });
          }
          // B. Apply to new customer
          let d = customer.debit || 0, c = customer.credit || 0;
          let remaining = grandTotal;
          if (c >= remaining) c -= remaining;
          else { remaining -= c; c = 0; d += remaining; }
          customer.debit = Math.round(d); customer.credit = Math.round(c);
          customer.closingBalance = Math.round((customer.closingBalance || 0) + grandTotal);
          customer.totalBalance = customer.closingBalance;
          await customer.save({ session });
        } else {
          // Standard delta for same customer
          const totalDelta = salesOrder.invoiceGenerated ? (grandTotal - lastGrandTotal) : grandTotal;
          if (totalDelta !== 0) {
            let d = customer.debit || 0, c = customer.credit || 0;
            let delta = totalDelta;
            if (delta > 0) {
              if (c >= delta) c -= delta;
              else { delta -= c; c = 0; d += delta; }
            } else {
              const absDelta = Math.abs(delta);
              if (d >= absDelta) d -= absDelta;
              else { const excess = absDelta - d; d = 0; c += excess; }
            }
            customer.debit = Math.round(d); customer.credit = Math.round(c);
            customer.closingBalance = Math.round((customer.closingBalance || 0) + totalDelta);
            customer.totalBalance = customer.closingBalance;
            await customer.save({ session });
          }
        }

        // ==========================================
        // 5️⃣ SAVE INVOICE & SALES ORDER
        // ==========================================
        const customerSnapshot = {
          customerId: customer._id,
          name: customer.name,
          whatsapp: customer.whatsapp,
          address: customer.address,
          district: customer.district,
          state: customer.state,
          stateCode: customer.stateCode,
          pincode: customer.pincode,
          gstin: customer.gstin,
        };

        // Seller details snapshot (uses 'branch' variable fetched earlier)
        const sellerSnapshot = branch ? {
          name: branch.name,
          address: branch.address,
          state: branch.state,
          pincode: branch.pincode,
          gstin: branch.gstin,
          phone: branch.phone || branch.contactNumber,
          gpayNo: branch.gpayNo || "",
          upiId: branch.upiId || "",
          stateCode: branch.stateCode || "33",
        } : {};

        if (invoice) {
          invoice.customer = customerSnapshot;
          invoice.seller = sellerSnapshot;
          invoice.items = processedItems;
          invoice.subtotal = grossSubtotal;
          invoice.totalTax = totalTax;
          invoice.transportCharge = tCharge;
          invoice.transportGstPercent = tGstPercent;
          invoice.transportGstAmount = tGstAmount;
          invoice.commonDiscount = commonDiscount;
          invoice.extraExpenseAmount = extraExpenseAmount;
          invoice.grandTotal = grandTotal;
          await invoice.save({ session });
        } else {
          invoice = new Invoice({
            invoiceNumber,
            invoiceDate: salesOrder.orderDate || salesOrder.createdAt || new Date(),
            financialYear,
            salesOrderId: salesOrder._id,
            branchId: salesOrder.branchId,
            warehouse: salesOrder.warehouse,
            seller: sellerSnapshot,
            customer: customerSnapshot,
            items: processedItems,
            sampleItems: salesOrder.sampleItems || [],
            subtotal: grossSubtotal,
            totalTax,
            transportCharge: tCharge,
            transportGstPercent: tGstPercent,
            transportGstAmount: tGstAmount,
            commonDiscount: commonDiscount,
            extraExpenseAmount: extraExpenseAmount,
            grandTotal,
            status: "FINALIZED",
          });
          await invoice.save({ session });
        }

        // ==========================================
        // 5️⃣ UPDATE INVOICE HISTORY & APPEND NEW ITEMS
        // ==========================================
        // 1. Identify and append BRAND NEW items added directly in the workbench
        // Items with an _id are from the original SO. Items without _id are new.
        const newItemsFromWorkbench = items.filter(item => !item._id);
        if (newItemsFromWorkbench.length > 0) {
          newItemsFromWorkbench.forEach(ni => {
            salesOrder.items.push({
              productId: ni.productId,
              name: ni.name,
              hsn: ni.hsn,
              sellingPrice: Number(ni.sellingPrice),
              unit: ni.unit,
              qty: Number(ni.originalQty || ni.qty),
              discountPercent: Number(ni.discountPercent || 0),
              discountAmount: Number(ni.discountAmount || 0),
              gst: Number(ni.gst),
              cgst: Number(ni.cgst),
              sgst: Number(ni.sgst),
              igst: Number(ni.igst || 0),
              total: Number(ni.total)
            });
          });
        }

        // 2. Store the FULL Workbench State as the source of truth for re-edits
        // This includes all discounts, corrected prices, and excludes deleted items.
        salesOrder.invoiceItems = processedItems;
        salesOrder.invoiceGrandTotal = grandTotal;
        salesOrder.invoiceSubtotal = grossSubtotal;
        salesOrder.invoiceTotalTax = totalTax.total;
        salesOrder.invoiceTransportCharge = tCharge;
        salesOrder.invoiceCommonDiscount = commonDiscount;

        // DONT overwrite salesOrder.items. Keep the baseline stable.
        // salesOrder.items = updatedMasterItems; // REMOVED to keep SO stable
        salesOrder.subtotal = grossSubtotal;
        salesOrder.totalTax = totalTax.total;
        salesOrder.transportCharge = tCharge;
        salesOrder.transportGstPercent = tGstPercent;
        salesOrder.transportGstAmount = tGstAmount;
        salesOrder.commonDiscount = commonDiscount;
        // master grandTotal stays related to original SO or updates with new items if needed
        // For simplicity and user request, we focus financial tracking on the Invoice documents
        salesOrder.notes = notes;
        salesOrder.invoiceGenerated = true;
        salesOrder.status = "INVOICED";
        salesOrder.salesInvoiceId = invoiceNumber;
        salesOrder.lastInvoicedGrandTotal = grandTotal;
        salesOrder.lastInvoicedCustomerId = customer._id;
        salesOrder.lastInvoicedItems = processedItems;
        salesOrder.invoiceItems = processedItems; // Sync to schema field
        if (isCustomerSwapped) salesOrder.customer = customerSnapshot;

        salesOrder.editHistory.push({
          version: salesOrder.editHistory.length + 1,
          editType: "INVOICED",
          grandTotal,
          editedAt: new Date(),
          note: `Invoice ${invoiceNumber} finalized. ${isCustomerSwapped ? 'Customer Swap Applied.' : ''}`
        });

        await salesOrder.save({ session });

        await session.commitTransaction();
        session.endSession();
        finalizeSuccess = true;
        return res.json({ success: true, invoiceNumber, invoiceId: invoice._id, invoice: invoice.toObject ? invoice.toObject() : invoice });

      } catch (error) {
        await session.abortTransaction();
        session.endSession();
        if (retries > 1 && (error.code === 112 || error.hasErrorLabel?.('TransientTransactionError'))) {
          retries--; await new Promise(r => setTimeout(r, 100)); continue;
        }
        throw error;
      }
    }
  } catch (error) {
    console.error("❌ Error during invoice finalization:", error);
    res.status(500).json({ message: error.message || "Failed to finalize invoice" });
  }
});


// PUT - Mark as printed
router.put("/:invoiceId/print", async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { printedBy, printedByUsername, branchId } = req.body;

    const invoice = await Invoice.findByIdAndUpdate(
      invoiceId,
      {
        $inc: { printCount: 1 },
        status: "PRINTED",
      },
      { new: true }
    );

    if (invoice) {
      await createAuditLog({
        userId: printedBy || invoice.billingPerson || "System",
        username: printedByUsername || invoice.billingPerson || "System",
        branchId: branchId || invoice.branchId,
        action: "PRINT_BILL",
        description: `Printed Bill: ${invoice.invoiceNumber}. Print #${invoice.printCount}. Amount: ₹${invoice.grandTotal}`,
        targetId: invoice._id,
        targetModel: "Invoice",
      });
    }

    res.json(invoice);
  } catch (error) {
    console.error("Error updating print status:", error);
    res.status(500).json({ message: "Failed to update print status" });
  }
});

// PUT - Mark as WhatsApp sent
router.put("/:invoiceId/whatsapp", async (req, res) => {
  try {
    const { invoiceId } = req.params;

    const invoice = await Invoice.findByIdAndUpdate(
      invoiceId,
      {
        $set: { whatsappSent: true, whatsappSentAt: new Date() },
        $inc: { whatsappCount: 1 },
      },
      { new: true }
    );

    res.json({
      message: "WhatsApp marked as sent",
      invoice,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Failed to update WhatsApp status" });
  }
});

// POST - Upload Invoice Image to Cloudinary
router.post("/:invoiceId/upload-cloudinary", upload.single("file"), async (req, res) => {
  try {
    const { invoiceId } = req.params;

    if (!req.file) {
      return res.status(400).json({ message: "No file provided" });
    }

    // Upload to Cloudinary from buffer
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "pearls-erp/invoices",
        resource_type: "auto",
        public_id: `invoice-${invoiceId}-${Date.now()}`,
      },
      async (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          return res.status(500).json({ message: "Cloudinary upload failed" });
        }

        res.json({
          message: "Invoice uploaded to Cloudinary",
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    // Write buffer to stream
    uploadStream.end(req.file.buffer);
  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    res.status(500).json({ message: "Failed to upload invoice" });
  }
});

// GET - Get all invoices for a specific customer
router.get("/customer/:customerId", async (req, res) => {
  try {
    const { customerId } = req.params;
    const { branchId } = req.query;

    if (!customerId) {
      return res.status(400).json({ message: "customerId is required" });
    }

    const query = { "customer.customerId": customerId };
    if (branchId) {
      query.branchId = branchId;
    }

    // 🔥 Filter out invoices that already have a Credit Note
    const existingCNs = await CreditNote.find({
      "customer.customerId": customerId,
      status: "Created",
      originalSalesOrderId: { $ne: null }
    }).select("originalSalesOrderId");

    const creditedSalesOrderIds = existingCNs.map(cn => cn.originalSalesOrderId.toString());

    const invoices = await Invoice.find({
      ...query,
      salesOrderId: { $nin: creditedSalesOrderIds }
    })
      .populate("salesOrderId")
      .sort({ invoiceDate: -1 })
      .lean();

    res.json(invoices);
  } catch (error) {
    console.error("Error fetching customer invoices:", error);
    res.status(500).json({ message: "Failed to fetch invoices" });
  }
});

// PUT - Cancel Invoice
router.put("/:invoiceId/cancel", async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { invoiceId } = req.params;
    const { reason, cancelledBy } = req.body;

    const invoice = await Invoice.findById(invoiceId).session(session);
    if (!invoice) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Invoice not found" });
    }

    if (invoice.status === "CANCELLED") {
      await session.abortTransaction();
      return res.status(400).json({ message: "Invoice is already cancelled" });
    }

    // 1. REVERT CUSTOMER BALANCE
    const customer = await Customer.findById(invoice.customer.customerId).session(session);
    if (customer) {
      const amountToRevert = invoice.grandTotal || 0;
      let curDebit = customer.debit || 0;
      let curCredit = customer.credit || 0;

      // Reduction: Consume debit first, then increase credit
      if (curDebit >= amountToRevert) {
        curDebit -= amountToRevert;
      } else {
        const excess = amountToRevert - curDebit;
        curDebit = 0;
        curCredit += excess;
      }

      customer.debit = Math.round(curDebit);
      customer.credit = Math.round(curCredit);
      customer.closingBalance = Math.round((customer.closingBalance || 0) - amountToRevert);
      customer.totalBalance = customer.closingBalance;
      await customer.save({ session });
      console.log(`💰 Balance Reverted for ${customer.name}: -₹${amountToRevert}`);
    }

    // 2. REVERT STOCK
    for (const item of invoice.items) {
      const product = await Product.findById(item.productId).session(session);
      if (product) {
        product.totalQty = (product.totalQty || 0) + (item.qty || 0);
        await product.save({ session });
        console.log(`📦 Stock Reverted for ${product.name}: +${item.qty}`);
      }
    }

    // 3. UPDATE INVOICE STATUS
    invoice.status = "CANCELLED";
    invoice.cancelReason = reason || "No reason provided";
    invoice.cancelledAt = new Date();
    invoice.cancelledBy = cancelledBy || "System";
    await invoice.save({ session });

    // 4. UPDATE SALES ORDER
    if (invoice.salesOrderId) {
      const salesOrder = await SalesOrder.findById(invoice.salesOrderId).session(session);
      if (salesOrder) {
        salesOrder.invoiceGenerated = false;
        salesOrder.salesInvoiceId = null;
        salesOrder.status = "PLACED"; // Reset to placed so it can be invoiced again

        // Add cancellation to history
        salesOrder.editHistory.push({
          version: (salesOrder.editHistory.length || 0) + 1,
          editType: "PRE_INVOICE_EDIT",
          items: salesOrder.items,
          subtotal: salesOrder.subtotal,
          totalTax: salesOrder.totalTax,
          grandTotal: salesOrder.grandTotal,
          editedAt: new Date(),
          note: `Invoice ${invoice.invoiceNumber} CANCELLED. Reason: ${reason}`
        });

        await salesOrder.save({ session });
      }
    }

    await session.commitTransaction();
    res.json({ success: true, message: "Invoice cancelled successfully" });
  } catch (error) {
    await session.abortTransaction();
    console.error("❌ Error cancelling invoice:", error);
    res.status(500).json({ message: error.message || "Failed to cancel invoice" });
  } finally {
    session.endSession();
  }
});

// GET - Get all invoices for a branch
// GET sales invoices with pagination and filtering (Sales Reports)
router.get("", async (req, res) => {
  try {
    const { branchId, fromDate, toDate, search, page = 1, limit = 20, vPrefix, einvoiceStatus, includeItems } = req.query;
    const query = {};

    // 1. Branch Filter
    if (branchId) query.branchId = branchId;

    // 2. Voucher Prefix Filter (⚡ High Performance Indexed Regex)
    if (vPrefix) {
      query.invoiceNumber = { $regex: `^${vPrefix}`, $options: "i" };
    }

    // 3. E-Invoice Status Filter (Fix: Handle nulls for PENDING)
    if (einvoiceStatus === "NOT_GENERATED") {
      query.einvoiceStatus = { $in: ["NOT_GENERATED", null, ""] };
    } else if (einvoiceStatus) {
      query.einvoiceStatus = einvoiceStatus;
    }

    // 4. Search (Customer or Number)
    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: "i" } },
        { "customer.name": { $regex: search, $options: "i" } },
        { "customer.whatsapp": { $regex: search, $options: "i" } },
      ];
    }

    // 5. Date Filtering (Cumulative – applies unless dates are explicitly cleared or searching all-time)
    // In this dashboard, if fromDate/toDate are passed, we stick to them.
    if (fromDate || toDate) {
      const start = fromDate ? new Date(fromDate) : new Date();
      if (!fromDate) start.setHours(0, 0, 0, 0);

      const end = toDate ? new Date(toDate) : new Date(start);
      end.setHours(23, 59, 59, 999);

      query.invoiceDate = { $gte: start, $lte: end };
    } 

    const skip = (parseInt(page) - 1) * parseInt(limit);

    let queryExec = Invoice.find(query)
      .populate("customer.customerId", "name whatsapp")
      .populate("salesOrderId");

    // ⚡ THIN FETCHING: Skip heavy items array unless explicitly requested for reports
    if (includeItems !== "true") {
      queryExec = queryExec.select("-items -__v");
    }

    const invoices = await queryExec
      .sort({ invoiceDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Invoice.countDocuments(query);
    const pages = Math.ceil(total / parseInt(limit));

    res.json({
      data: invoices,
      pagination: {
        total,
        pages,
        page: parseInt(page),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching sales invoices:", error);
    res.status(500).json({ message: "Failed to fetch sales invoices" });
  }
});

// GET - Get single invoice details (with items) for Lazy Loading & Printing
router.get("/:id", async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate("customer.customerId")
      .populate("salesOrderId")
      .populate("branchId")
      .select("+items") // Explicitly include items if they were globally excluded
      .lean();

    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

    res.json({ success: true, data: invoice });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Legacy: GET all invoices without pagination
router.get("/legacy", async (req, res) => {
  try {
    const { branchId, invoiceType, salesOrderId } = req.query;

    const query = {};
    if (branchId) query.branchId = branchId;
    if (invoiceType) query.invoiceType = invoiceType;
    if (salesOrderId) query.salesOrderId = salesOrderId;

    const invoices = await Invoice.find(query)
      .populate("customer.customerId", "name whatsapp")
      .populate("salesOrderId")
      .sort({ createdAt: -1 });

    res.json(invoices);
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({ message: "Failed to fetch invoices" });
  }
});

// PUT - Soft Cancel Invoice
router.put("/:invoiceId/cancel", async (req, res) => {
  const { invoiceId } = req.params;
  const { reason, cancelledBy } = req.body;

  if (!reason) {
    return res.status(400).json({ message: "Narration/Reason is mandatory for cancellation" });
  }

  let retries = 3;
  while (retries > 0) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const invoice = await Invoice.findById(invoiceId).session(session);
      if (!invoice || invoice.status === 'CANCELLED') {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: "Invoice not found or already cancelled" });
      }

      // 1. Revert Stock Atomically
      for (const item of invoice.items) {
        await Product.updateOne(
          { _id: item.productId },
          { $inc: { totalQty: item.qty } },
          { session }
        );
      }

      // 2. Revert Customer Balance
      const customerId = invoice.customer?.customerId || invoice.customer;
      const customer = await Customer.findById(customerId).session(session);
      if (customer && invoice.grandTotal > 0) {
        const amountToRevert = invoice.grandTotal;
        let curDebit = customer.debit || 0;
        let curCredit = customer.credit || 0;

        if (curDebit >= amountToRevert) {
          curDebit -= amountToRevert;
        } else {
          const excess = amountToRevert - curDebit;
          curDebit = 0;
          curCredit += excess;
        }

        customer.debit = Math.round(curDebit);
        customer.credit = Math.round(curCredit);
        customer.closingBalance = Math.round((customer.closingBalance || 0) - amountToRevert);
        customer.totalBalance = customer.closingBalance;
        await customer.save({ session });
      }

      // 3. Mark Invoice as Cancelled
      invoice.status = "CANCELLED";
      invoice.cancelReason = reason;
      invoice.cancelledAt = new Date();
      invoice.cancelledBy = cancelledBy || "System";
      await invoice.save({ session });

      // 4. Update Sales Order
      if (invoice.salesOrderId) {
        const so = await SalesOrder.findById(invoice.salesOrderId).session(session);
        if (so) {
          so.status = "PLACED"; // Reset to enabled so it can be re-invoiced
          so.invoiceGenerated = false;
          so.salesInvoiceId = null; // Clear SI reference
          so.editHistory.push({
            version: so.editHistory.length + 1,
            editType: "CANCELLED",
            editedAt: new Date(),
            note: `Invoice ${invoice.invoiceNumber} Cancelled. Reason: ${reason}`
          });
          await so.save({ session });
        }
      }

      // 5. Audit Log
      await createAuditLog({
        userId: cancelledBy || "System",
        username: cancelledBy || "System",
        branchId: invoice.branchId,
        action: "CANCEL_INVOICE",
        description: `Cancelled Invoice: ${invoice.invoiceNumber}. Reason: ${reason}`,
        targetId: invoice._id,
        targetModel: "Invoice"
      });

      await session.commitTransaction();
      session.endSession();
      return res.json({ success: true, message: "Invoice cancelled successfully" });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();

      if (retries > 1 && (error.code === 112 || error.hasErrorLabel?.('TransientTransactionError'))) {
        console.warn(`⚠️ Write conflict in Cancel (INV: ${invoiceId}). Retrying...`);
        retries--;
        await new Promise(r => setTimeout(r, 100));
        continue;
      }
      console.error("❌ Error cancelling invoice:", error);
      return res.status(500).json({ message: error.message || "Failed to cancel invoice" });
    }
  }
});

// DELETE - Delete invoice and revert all changes (Stock & Balance) - With Retry
router.delete("/:invoiceId", async (req, res) => {
  const { invoiceId } = req.params;
  const { deletedBy } = req.query;

  let retries = 3;
  while (retries > 0) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const invoice = await Invoice.findById(invoiceId).session(session);
      if (!invoice) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: "Invoice not found" });
      }

      // 1. Revert Stock Atomically
      for (const item of invoice.items) {
        await Product.updateOne(
          { _id: item.productId },
          { $inc: { totalQty: item.qty } },
          { session }
        );
      }

      // 2. Revert Balance
      const customerId = invoice.customer?.customerId || invoice.customer;
      const customer = await Customer.findById(customerId).session(session);
      if (customer && invoice.grandTotal > 0) {
        let amount = invoice.grandTotal;
        let curDebit = customer.debit || 0;
        let curCredit = customer.credit || 0;

        if (curDebit >= amount) {
          curDebit -= amount;
        } else {
          const excess = amount - curDebit;
          curDebit = 0;
          curCredit += excess;
        }

        customer.debit = Math.round(curDebit);
        customer.credit = Math.round(curCredit);
        customer.closingBalance = Math.round((customer.closingBalance || 0) - amount);
        customer.totalBalance = customer.closingBalance;
        await customer.save({ session });
      }

      // 3. Reset Sales Order
      if (invoice.salesOrderId) {
        const so = await SalesOrder.findById(invoice.salesOrderId).session(session);
        if (so) {
          so.status = "PENDING";
          so.invoiceGenerated = false;
          so.salesInvoiceId = null;
          so.lastInvoicedItems = [];
          so.lastInvoicedGrandTotal = 0;
          so.recordType = "SALES ORDER";
          so.editHistory.push({
            version: so.editHistory.length + 1,
            editType: 'INVOICE_CANCELLED',
            editedAt: new Date(),
            note: `Invoice ${invoice.invoiceNumber} deleted. Status reset to PENDING.`
          });
          await so.save({ session });
        }
      }

      // 4. Audit Log
      await createAuditLog({
        userId: deletedBy || "System",
        username: deletedBy || "System",
        branchId: invoice.branchId,
        action: "DELETE_INVOICE",
        description: `Permanently Deleted Invoice: ${invoice.invoiceNumber}.`,
        targetId: invoice._id,
        targetModel: "Invoice"
      });

      // 5. Delete Document
      await Invoice.findByIdAndDelete(invoiceId).session(session);

      await session.commitTransaction();
      session.endSession();
      return res.json({ success: true, message: "Invoice deleted successfully." });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      if (retries > 1 && (error.code === 112 || error.hasErrorLabel?.('TransientTransactionError'))) {
        retries--;
        await new Promise(r => setTimeout(r, 100));
        continue;
      }
      return res.status(500).json({ message: error.message || "Failed to delete invoice" });
    }
  }
});

export default router;

