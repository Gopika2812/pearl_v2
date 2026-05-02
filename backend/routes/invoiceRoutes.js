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

const isToday = (date) => {
  if (!date) return true;
  const d = new Date(date);
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
};

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
      extraExpenses: customExtraExpenses,
      finalizedBy,
      finalizedByUsername
    } = req.body;

    const salesOrder = await SalesOrder.findById(salesOrderId)
      .populate("branchId")
      .populate({
        path: "customer.customerId",
        populate: { path: "customerGroup" }
      })
      .populate("items.productId lastInvoicedItems.productId");

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
      
      // FALLBACK GST LOGIC: Use originalItem values, but if 0, check productId master data
      const gstPercent = Number(item.gst || (originalItem ? (originalItem.gst || originalItem.productId?.gst || 0) : 0));
      const cgstPercent = Number(item.cgst || (originalItem ? (originalItem.cgst || (gstPercent ? gstPercent / 2 : 0)) : (gstPercent / 2)));
      const sgstPercent = Number(item.sgst || (originalItem ? (originalItem.sgst || (gstPercent ? gstPercent / 2 : 0)) : (gstPercent / 2)));
      const igstPercent = Number(item.igst || (originalItem ? (originalItem.igst || 0) : 0));
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

    const extraExpensesList = customExtraExpenses !== undefined ? customExtraExpenses : (salesOrder.extraExpenses || []);

    let extraExpenseCgst = 0, extraExpenseSgst = 0, extraExpenseIgst = 0;
    extraExpensesList.forEach(exp => {
      const gstAmt = Number(exp.gstAmount || 0);
      if (igstTotal === 0) {
        extraExpenseCgst += gstAmt / 2;
        extraExpenseSgst += gstAmt / 2;
      } else {
        extraExpenseIgst += gstAmt;
      }
    });

    const tGstPercent = customTransportGstPercent !== undefined
      ? Number(customTransportGstPercent)
      : (salesOrder.transportGstPercent || 0);
    const tGstAmount = Math.round((tCharge * tGstPercent / 100) * 100) / 100;

    const totalTax = {
      cgst: Math.round((cgstTotal + extraExpenseCgst + (igstTotal === 0 ? tGstAmount / 2 : 0)) * 100) / 100,
      sgst: Math.round((sgstTotal + extraExpenseSgst + (igstTotal === 0 ? tGstAmount / 2 : 0)) * 100) / 100,
      igst: Math.round((igstTotal + extraExpenseIgst + (igstTotal > 0 ? tGstAmount : 0)) * 100) / 100,
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

    // Predict Sales Invoice (SI) Number for Preview
    const financialYear = getFinancialYear();
    const useSoNumber = req.body.useSoNumber === true;
    let predictedSI = salesOrder.salesInvoiceId; // Use existing if already generated

    if (!predictedSI) {
      const rawSoId = salesOrder.invoiceId || "";
      // Robust prefix extraction and replacement
      const cleanSoId = rawSoId.replace(/^(SO|SO REF|SO\sREF)[:\s\-]*/i, "");
      const parts = cleanSoId.split('/');
      const soMainPrefix = parts[0];

      // Convert SO prefix to SI
      let siPrefix = soMainPrefix.endsWith("SO")
        ? soMainPrefix.replace(/SO$/i, "SI")
        : (soMainPrefix.endsWith("-SO") ? soMainPrefix.replace(/-SO$/i, "-SI") : (soMainPrefix.endsWith("O") ? soMainPrefix.replace(/O$/i, "I") : `${soMainPrefix}SI`));

      if (useSoNumber) {
        // Option A: Use SO Number but with SI Prefix
        predictedSI = `${siPrefix}/${parts.slice(1).join('/')}`;
      } else {
        // Option B: Sequential Generation
        const siVoucher = await VoucherType.findOne({
          branchId: salesOrder.branchId,
          prefix: siPrefix,
          orderType: "SI",
          financialYear
        });

        const existingInvoices = await Invoice.find({
          branchId: salesOrder.branchId,
          invoiceNumber: new RegExp(`^${siPrefix}/`),
          financialYear
        }).select('invoiceNumber').lean();

        let highestNumInDB = 0;
        existingInvoices.forEach(inv => {
          const parts = inv.invoiceNumber.split('/');
          if (parts.length >= 2) {
            const num = parseInt(parts[1]);
            if (!isNaN(num) && num > highestNumInDB) highestNumInDB = num;
          }
        });

        const nextNum = Math.max((siVoucher?.counter || 1), highestNumInDB + 1);
        predictedSI = `${siPrefix}/${String(nextNum).padStart(3, "0")}/${financialYear}`;
      }
    }

    // Dynamic balance calculation based on requested customer
    const bodyCustomerId = req.body.customerId;
    let customerToUse = salesOrder.customer?.customerId;
    let isCustomerSwapped = false;

    if (bodyCustomerId && bodyCustomerId !== customerToUse?._id?.toString()) {
      customerToUse = await Customer.findById(bodyCustomerId).populate("customerGroup").lean();
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

    // 🏦 SECURE SELLER DATA (Ensure branch info is fetched even if populate was shallow)
    let sellerInfo = salesOrder.branchId;
    if (sellerInfo && !sellerInfo.name) {
      // If it's just an ID or missing fields, fetch it fresh
      const branchData = await Branch.findById(sellerInfo._id || sellerInfo).lean();
      if (branchData) sellerInfo = branchData;
    }

    const previewData = {
      invoiceNumber: predictedSI,
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
        customerGroup: customerToUse.customerGroup?.name || customerToUse.customerGroup || salesOrder.customer?.customerGroup || "",
      } : {
        ...salesOrder.customer,
        customerGroup: salesOrder.customer?.customerId?.customerGroup?.name || salesOrder.customer?.customerGroup || ""
      },
      seller: {
        name: sellerInfo?.name || "PEARL AGENCY",
        address: sellerInfo?.address || "12/13, South By-Pass Road, Vanarpettai, Tirunelveli - 627003",
        state: sellerInfo?.state || "Tamil Nadu",
        pincode: sellerInfo?.pincode || "627003",
        gstin: sellerInfo?.gstin || "33DULPS2600Q1Z6",
        phone: sellerInfo?.phone || "9429692970",
        gpayNo: sellerInfo?.gpayNo || "",
        upiId: sellerInfo?.upiId || "",
        stateCode: sellerInfo?.stateCode || "33",
        logo: sellerInfo?.logo || "/logo.jpeg",
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
      extraExpenses: extraExpensesList,
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
      invoiceDate: salesOrder.orderDate || salesOrder.createdAt || new Date(), // Use SO date if available
    };

    res.json(previewData);
  } catch (error) {
    console.error("Error generating preview:", error);
    res.status(500).json({ message: "Failed to generate preview" });
  }
});

import auth from "../middleware/auth.js";


// POST - Finalize Invoice (save and generate)
router.post("/finalize/:salesOrderId", auth, async (req, res) => {
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
      extraExpenses: customExtraExpenses,
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
        const salesOrder = await SalesOrder.findById(salesOrderId).session(session).populate("items.productId lastInvoicedItems.productId invoiceItems.productId");

        if (!salesOrder) {
          await session.abortTransaction();
          session.endSession();
          return res.status(404).json({ message: "Sales order not found" });
        }

        const alreadyInvoiced = salesOrder.invoiceGenerated || salesOrder.status === "INVOICED";
        const branch = await Branch.findById(salesOrder.branchId).session(session);

        // 🛡️ CHECK: Edit Previous Day Permission
        if (alreadyInvoiced && req.user.role !== "SUPER_ADMIN") {
          const existingInvoice = await Invoice.findOne({ salesOrderId: salesOrder._id }).session(session);
          if (existingInvoice && !isToday(existingInvoice.invoiceDate)) {
            if (req.user.actionPermissions?.editPreviousDay === false) {
              await session.abortTransaction();
              session.endSession();
              return res.status(403).json({ success: false, message: "Permission Denied: You cannot edit invoices from a previous day." });
            }
          }
        }

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
        // 0️⃣ PERMISSION CHECK & DIFFING (MODIFICATIONS)
        // ==========================================
        const baselineItems = salesOrder.invoiceItems && salesOrder.invoiceItems.length > 0 ? salesOrder.invoiceItems : salesOrder.items;
        
        let modificationDetails = [];
        let isModified = false;

        // A. Check for Added Items
        const addedItems = items.filter(item => !item._id);
        if (addedItems.length > 0) {
          isModified = true;
          addedItems.forEach(i => modificationDetails.push(`Added: ${i.name} (Qty: ${i.qty}, Price: ₹${i.sellingPrice})`));
        }

        // B. Check for Deleted Items
        const currentItemIds = items.filter(i => i._id).map(i => i._id.toString());
        baselineItems.forEach(bi => {
          if (!currentItemIds.includes(bi._id.toString())) {
            isModified = true;
            modificationDetails.push(`Removed: ${bi.name}`);
          }
        });

        // C. Check for Modified Items (Price, Qty, Discount)
        items.filter(i => i._id).forEach(item => {
          const original = baselineItems.find(bi => bi._id.toString() === item._id);
          if (original) {
            const currentConfirmedQty = Number(item.confirmedQty || item.qty || 0);
            const originalQty = Number(original.confirmedQty || original.qty || 0);
            const currentPrice = Number(item.sellingPrice);
            const originalPrice = Number(original.sellingPrice);
            const currentDisc = Number(item.discountPercent || 0);
            const originalDisc = Number(original.discountPercent || 0);

            if (currentPrice !== originalPrice) {
              isModified = true;
              modificationDetails.push(`${item.name} Price: ${originalPrice} - ${currentPrice}`);
            }
            if (currentDisc !== originalDisc) {
              isModified = true;
              modificationDetails.push(`${item.name} Discount: ${originalDisc}% - ${currentDisc}%`);
            }
            if (currentConfirmedQty !== originalQty) {
              isModified = true;
              modificationDetails.push(`${item.name} Qty: ${originalQty} - ${currentConfirmedQty}`);
            }
          }
        });

        // D. Check Global Fields
        if (customCommonDiscount !== undefined && Number(customCommonDiscount) !== (salesOrder.commonDiscount || 0)) {
          isModified = true;
          modificationDetails.push(`Spl. Discount: ₹${salesOrder.commonDiscount || 0} → ₹${customCommonDiscount}`);
        }
        if (customTransportCharge !== undefined && Number(customTransportCharge) !== (salesOrder.transportCharge || 0)) {
          isModified = true;
          modificationDetails.push(`Transport: ₹${salesOrder.transportCharge || 0} → ₹${customTransportCharge}`);
        }

        // 🛡️ ENFORCE PERMISSION (Granular)
        if (isModified && req.user.role !== "SUPER_ADMIN") {
          const fieldPerms = req.user.fieldPermissions || {};
          const pageId = "sales-order-list";

          // A. Check Add
          if (addedItems.length > 0 && fieldPerms[`${pageId}_action_wb_add`] === false) {
            await session.abortTransaction();
            session.endSession();
            return res.status(403).json({ success: false, message: "Permission Denied: You cannot add items in the workbench." });
          }

          // B. Check Delete
          const deletedCount = baselineItems.filter(bi => !currentItemIds.includes(bi._id.toString())).length;
          if (deletedCount > 0 && fieldPerms[`${pageId}_action_wb_delete`] === false) {
            await session.abortTransaction();
            session.endSession();
            return res.status(403).json({ success: false, message: "Permission Denied: You cannot remove items from the workbench." });
          }

          // C. Check Modif (Price, Qty, Discount)
          for (const item of items.filter(i => i._id)) {
            const original = baselineItems.find(bi => bi._id.toString() === item._id);
            if (!original) continue;

            if (Number(item.sellingPrice) !== Number(original.sellingPrice) && fieldPerms[`${pageId}_action_wb_price`] === false) {
              await session.abortTransaction();
              session.endSession();
              return res.status(403).json({ success: false, message: "Permission Denied: You cannot modify prices in the workbench." });
            }
            if (Number(item.discountPercent || 0) !== Number(original.discountPercent || 0) && fieldPerms[`${pageId}_action_wb_discount`] === false) {
              await session.abortTransaction();
              session.endSession();
              return res.status(403).json({ success: false, message: "Permission Denied: You cannot modify discounts in the workbench." });
            }
            if (Number(item.confirmedQty || item.qty) !== Number(original.confirmedQty || original.qty) && fieldPerms[`${pageId}_action_wb_qty`] === false) {
              await session.abortTransaction();
              session.endSession();
              return res.status(403).json({ success: false, message: "Permission Denied: You cannot modify quantities (Backorder) in the workbench." });
            }
          }

          // D. Check Global Financials
          if (customCommonDiscount !== undefined && Number(customCommonDiscount) !== (salesOrder.commonDiscount || 0) && fieldPerms[`${pageId}_action_wb_discount`] === false) {
            await session.abortTransaction();
            session.endSession();
            return res.status(403).json({ success: false, message: "Permission Denied: You cannot modify special discounts." });
          }
        }

        const modificationSummary = modificationDetails.length > 0 ? ` Changes: ${modificationDetails.join(" | ")}` : "";

        // ==========================================
        // 1️⃣ GENERATE OR REUSE INVOICE NUMBER
        // ==========================================
        let invoice = await Invoice.findOne({ salesOrderId: salesOrder._id }).session(session);
        let invoiceNumber;

        if (invoice) {
          invoiceNumber = invoice.invoiceNumber;
        } else {
          const useSoNumber = req.body.useSoNumber === true;
          const rawSoId = salesOrder.invoiceId || "";
          const cleanSoId = rawSoId.replace(/^(SO|SO REF|SO\sREF)[:\s\-]*/i, "");
          const parts = cleanSoId.split('/');
          const soMainPrefix = parts[0];

          let siPrefix = soMainPrefix.endsWith("SO")
            ? soMainPrefix.replace(/SO$/i, "SI")
            : (soMainPrefix.endsWith("-SO") ? soMainPrefix.replace(/-SO$/i, "-SI") : (soMainPrefix.endsWith("O") ? soMainPrefix.replace(/O$/i, "I") : `${soMainPrefix}SI`));

          if (useSoNumber) {
            // Option A: Match SO sequential ID but swap prefix to SI
            invoiceNumber = `${siPrefix}/${parts.slice(1).join('/')}`;
          } else {
            // Option B: Generate NEW sequential SI number
            let siVoucher = await VoucherType.findOne({
              branchId: salesOrder.branchId,
              prefix: siPrefix,
              orderType: "SI",
              financialYear
            }).session(session);

            if (!siVoucher) {
              siVoucher = new VoucherType({
                branchId: salesOrder.branchId,
                name: soMainPrefix.toLowerCase().replace(/so$/i, ""),
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
            invoiceNumber = `${siPrefix}/${String(nextNum).padStart(3, "0")}/${financialYear}`;
            siVoucher.counter = nextNum + 1;
            await siVoucher.save({ session });
          }
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
          
          // FALLBACK GST LOGIC
          const gstPercent = Number(item.gst || (originalItem ? (originalItem.gst || originalItem.productId?.gst || 0) : 0));
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
            cgst: item.cgst !== undefined ? Number(item.cgst) : (originalItem ? (originalItem.cgst || (item.igst ? 0 : gstPercent / 2)) : (item.igst ? 0 : gstPercent / 2)),
            sgst: item.sgst !== undefined ? Number(item.sgst) : (originalItem ? (originalItem.sgst || (item.igst ? 0 : gstPercent / 2)) : (item.igst ? 0 : gstPercent / 2)),
            igst: item.igst !== undefined ? Number(item.igst) : (originalItem ? (originalItem.igst || 0) : 0),
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
        const extraExpensesList = customExtraExpenses !== undefined ? customExtraExpenses : (salesOrder.extraExpenses || []);

        let extraExpenseCgst = 0, extraExpenseSgst = 0, extraExpenseIgst = 0;
        extraExpensesList.forEach(exp => {
          const gstAmt = Number(exp.gstAmount || 0);
          if (igstTotal === 0) {
            extraExpenseCgst += gstAmt / 2;
            extraExpenseSgst += gstAmt / 2;
          } else {
            extraExpenseIgst += gstAmt;
          }
        });

        const tGstPercent = customTransportGstPercent !== undefined
          ? Number(customTransportGstPercent)
          : (salesOrder.transportGstPercent || 0);
        const tGstAmount = Math.round((tCharge * tGstPercent / 100) * 100) / 100;
        const totalTax = {
          cgst: Math.round((cgstTotal + extraExpenseCgst + (igstTotal === 0 ? tGstAmount / 2 : 0)) * 100) / 100,
          sgst: Math.round((sgstTotal + extraExpenseSgst + (igstTotal === 0 ? tGstAmount / 2 : 0)) * 100) / 100,
          igst: Math.round((igstTotal + extraExpenseIgst + (igstTotal > 0 ? tGstAmount : 0)) * 100) / 100,
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
          ...processedItems.map(i => i.productId ? (i.productId._id || i.productId).toString() : null).filter(Boolean),
          ...lastItems.map(i => i.productId ? (i.productId._id || i.productId).toString() : null).filter(Boolean)
        ]);

        for (const pId of allProductIds) {
          const newItem = processedItems.find(i => i.productId && (i.productId._id || i.productId).toString() === pId);
          const oldItem = lastItems.find(i => i.productId && (i.productId._id || i.productId).toString() === pId);
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
          invoice.extraExpenses = extraExpensesList;
          invoice.grandTotal = grandTotal;
          invoice.billingPerson = finalizedByUsername || invoice.billingPerson || "System";
          invoice.generatedBy = finalizedByUsername || invoice.generatedBy || "System";
          invoice.deliveryMan = salesOrder.deliveryMan;
          invoice.invoiceDate = salesOrder.orderDate || salesOrder.createdAt || new Date();
          await invoice.save({ session });
        } else {
          invoice = new Invoice({
            invoiceNumber,
            invoiceDate: salesOrder.orderDate || salesOrder.createdAt || new Date(), // Use SO date for finalization
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
            extraExpenses: extraExpensesList,
            grandTotal,
            billingPerson: finalizedByUsername || salesOrder.billingPerson || "System",
            generatedBy: finalizedByUsername || "System",
            deliveryMan: salesOrder.deliveryMan,
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
          editedBy: req.user.username, // ✨ NEW
          note: `Invoice ${invoiceNumber} finalized. ${isCustomerSwapped ? 'Customer Swap Applied.' : ''}`
        });

        await salesOrder.save({ session });

        // ✅ LOG SUCCESSFUL INVOICE FINALIZATION
        console.log(`📡 AUDIT LOG DEBUG: alreadyInvoiced=${alreadyInvoiced}, editHistory=${salesOrder.editHistory.length}`);
        await createAuditLog({
          userId: req.user.id,
          userModel: req.user.role === "SUPER_ADMIN" ? "SuperAdmin" : "BranchUser",
          username: req.user.username,
          branchId: salesOrder.branchId,
          action: isModified ? "BACK_ORDER_EDIT" : (alreadyInvoiced ? "RE_INVOICE_SO" : "INVOICE_SO"),
          description: `${alreadyInvoiced ? 'Regenerated' : 'Finalized'} Invoice: ${invoiceNumber} for Order: ${salesOrder.invoiceId}. Total: ₹${grandTotal}.${modificationSummary}`,
          targetId: invoice._id,
          targetModel: "Invoice",
        });

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

    const invoices = await Invoice.find(query)
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

// PUT - Revoke (Restore) Cancelled Invoice
router.put("/:invoiceId/revoke", async (req, res) => {
  return res.status(403).json({ success: false, message: "Revoke functionality has been disabled." });
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { invoiceId } = req.params;
    const { revokedBy } = req.body;

    const invoice = await Invoice.findById(invoiceId).session(session);
    if (!invoice) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Invoice not found" });
    }

    if (invoice.status !== "CANCELLED") {
      await session.abortTransaction();
      return res.status(400).json({ message: "Only cancelled invoices can be revoked" });
    }

    const salesOrder = await SalesOrder.findById(invoice.salesOrderId).session(session);
    if (!salesOrder) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: "Associated Sales Order not found. Cannot revoke." });
    }

    if (salesOrder.invoiceGenerated && salesOrder.salesInvoiceId && salesOrder.salesInvoiceId.toString() !== invoice._id.toString()) {
      await session.abortTransaction();
      return res.status(400).json({ 
        success: false,
        message: `Restoration Denied: Sales Order ${salesOrder.invoiceId} already has an active invoice (${salesOrder.salesInvoiceId}). You must cancel the active invoice before you can revoke this old one.` 
      });
    }

    // 1. RESTORE CUSTOMER BALANCE (Increase Liability)
    const customer = await Customer.findById(invoice.customer.customerId).session(session);
    if (customer) {
      const amountToRestore = invoice.grandTotal || 0;
      let curDebit = customer.debit || 0;
      let curCredit = customer.credit || 0;

      // Restoration (Sales): Increase debit or decrease credit
      if (curCredit >= amountToRestore) {
        curCredit -= amountToRestore;
      } else {
        const excess = amountToRestore - curCredit;
        curCredit = 0;
        curDebit += excess;
      }

      customer.debit = Math.round(curDebit);
      customer.credit = Math.round(curCredit);
      customer.closingBalance = Math.round((customer.closingBalance || 0) + amountToRestore);
      customer.totalBalance = customer.closingBalance;
      await customer.save({ session });
      console.log(`💰 Balance Restored for ${customer.name}: +₹${amountToRestore}`);
    }

    // 2. RESTORE STOCK (Decrease Available Qty)
    for (const item of invoice.items) {
      if (!item.productId) continue;
      const product = await Product.findById(item.productId).session(session);
      if (product) {
        product.totalQty = (product.totalQty || 0) - (item.qty || 0);
        await product.save({ session });
        console.log(`📦 Stock Restored (Decreased) for ${product.name}: -${item.qty}`);
      }
    }

    // 3. UPDATE INVOICE STATUS
    invoice.status = "PRINTED"; // Restore to standard invoiced status
    invoice.cancelReason = undefined;
    invoice.cancelledAt = undefined;
    invoice.cancelledBy = undefined;
    invoice.revokedBy = revokedBy || "System";
    invoice.revokedAt = new Date();
    await invoice.save({ session });

    // 4. UPDATE SALES ORDER
    salesOrder.invoiceGenerated = true;
    salesOrder.salesInvoiceId = invoice._id;
    salesOrder.status = "INVOICED";

    // Add revocation to history
    salesOrder.editHistory.push({
      version: (salesOrder.editHistory.length || 0) + 1,
      editType: "GENERAL_EDIT",
      items: salesOrder.items,
      subtotal: salesOrder.subtotal,
      totalTax: salesOrder.totalTax,
      grandTotal: salesOrder.grandTotal,
      editedAt: new Date(),
      note: `Invoice ${invoice.invoiceNumber} REVOKED/RESTORED by ${revokedBy || "System"}.`
    });

    await salesOrder.save({ session });

    await session.commitTransaction();
    res.json({ success: true, message: "Invoice revoked and restored successfully" });
  } catch (error) {
    await session.abortTransaction();
    console.error("❌ Error revoking invoice:", error);
    res.status(500).json({ message: error.message || "Failed to revoke invoice" });
  } finally {
    session.endSession();
  }
});

// POST - Get last invoice info for a batch of customers (for Follow-Up page)
router.post("/last-by-customers", async (req, res) => {
  try {
    const { customerIds, branchId } = req.body;
    if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
      return res.status(400).json({ success: false, message: "customerIds array required" });
    }

    const objectIds = customerIds
      .filter(id => mongoose.Types.ObjectId.isValid(id))
      .map(id => new mongoose.Types.ObjectId(id));

    const results = await Invoice.aggregate([
      {
        $match: {
          "customer.customerId": { $in: objectIds },
          status: { $ne: "CANCELLED" },
          ...(branchId ? { branchId: new mongoose.Types.ObjectId(branchId) } : {})
        }
      },
      { $sort: { invoiceDate: -1 } },
      {
        $group: {
          _id: "$customer.customerId",
          lastInvoiceNumber: { $first: "$invoiceNumber" },
          lastInvoiceDate: { $first: "$invoiceDate" }
        }
      }
    ]);

    res.json({ success: true, data: results });
  } catch (err) {
    console.error("Last by customers error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET - Get all invoices for a branch
// GET sales invoices with pagination and filtering (Sales Reports)
router.get("", async (req, res) => {
  try {
    const { branchId, fromDate, toDate, search, page = 1, limit = 20, vPrefix, einvoiceStatus, includeItems, deliveryStatus, storageMan, stockChecker, deliveryPerson } = req.query;
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

    // 4. Delivery Status Filter
    if (deliveryStatus && deliveryStatus !== "ALL") {
      if (deliveryStatus === "PENDING") {
        // For PENDING in history, only show those that were actually reverted from a completion
        query.isReverted = true;
      } else {
        query.deliveryStatus = deliveryStatus;
      }
    } else if (deliveryStatus === "ALL") {
      // For "ALL" history, show what's in progress or what was previously completed (reverted)
      query.$or = [
        { deliveryStatus: { $in: ["COMPLETED", "PICKED"] } },
        { isReverted: true }
      ];
    }

    // Staff Filters
    if (storageMan) query.storageMan = storageMan;
    if (stockChecker) query.stockChecker = stockChecker;
    if (deliveryPerson) query.deliveryPerson = deliveryPerson;

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
      end.setHours(23, 59, 59, 999); // Always set to end of day

      let dateFilter = {};
      if (deliveryStatus === "COMPLETED") {
        dateFilter = { deliveryCompletedAt: { $gte: start, $lte: end } };
      } else if (deliveryStatus === "ALL") {
        dateFilter = {
          $or: [
            { invoiceDate: { $gte: start, $lte: end } },
            { deliveryCompletedAt: { $gte: start, $lte: end } }
          ]
        };
      } else {
        dateFilter = { invoiceDate: { $gte: start, $lte: end } };
      }

      // Merge date filter into query safely
      if (query.$and) {
        query.$and.push(dateFilter);
      } else if (query.$or) {
        // If we have a search $or, wrap it in $and with the date filter
        const existingOR = query.$or;
        delete query.$or;
        query.$and = [{ $or: existingOR }, dateFilter];
      } else {
        // No search $or, but dateFilter might be an $or (for "ALL")
        if (dateFilter.$or) {
          query.$or = dateFilter.$or;
        } else {
          Object.assign(query, dateFilter);
        }
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const { sortBy = "invoiceDate", sortOrder = "desc" } = req.query;
    const sortObj = {};
    sortObj[sortBy] = sortOrder === "asc" ? 1 : -1;
    if (sortBy !== "createdAt") sortObj.createdAt = -1; // Secondary sort for stability

    let queryExec = Invoice.find(query)
      .populate("customer.customerId", "name whatsapp")
      .populate({
        path: "salesOrderId",
        populate: { path: "deliveryMan", select: "name phone" }
      })
      .populate("deliveryMan", "name phone");

    // ⚡ SPEED OPTIMIZATION: If full items are not requested, return essential fields for the list view
    if (includeItems !== "true") {
      queryExec = queryExec.select({
        items: { _id: 1 },
        invoiceNumber: 1,
        invoiceDate: 1,
        customer: 1,
        grandTotal: 1,
        subtotal: 1,
        totalTax: 1,
        commonDiscount: 1,
        transportCharge: 1,
        extraExpenseAmount: 1,
        einvoiceStatus: 1,
        ewayBillNo: 1,
        ewayBillPdfUrl: 1,
        invoicePdfUrl: 1,
        irn: 1,
        signedQrCodeImgUrl: 1,
        billingPerson: 1,
        generatedBy: 1,
        status: 1,
        branchId: 1,
        salesOrderId: 1,
        createdAt: 1,
        area: 1,
        storageMan: 1,
        storageManComment: 1,
        stockChecker: 1,
        stockCheckerComment: 1,
        deliveryPerson: 1,
        deliveryMan: 1,
        deliveryPersonComment: 1,
        deliveryStatus: 1,
        deliveryCompletedAt: 1,
        deliveryPaymentType: 1,
        isReverted: 1
      });
    }

    const invoices = await queryExec
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Invoice.countDocuments(query);
    const pages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
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
      .populate({
        path: "salesOrderId",
        populate: { path: "deliveryMan" }
      })
      .populate("branchId")
      .populate("items.productId")
      .populate("deliveryMan")
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
router.put("/:invoiceId/cancel", auth, async (req, res) => {
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

      // 🛡️ CHECK: Edit Previous Day Permission
      if (req.user.role !== "SUPER_ADMIN" && !isToday(invoice.invoiceDate)) {
        if (req.user.actionPermissions?.editPreviousDay === false) {
          await session.abortTransaction();
          session.endSession();
          return res.status(403).json({ success: false, message: "Permission Denied: You cannot cancel invoices from a previous day." });
        }
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
          so.status = "CANCELLED"; // Mark SO as Cancelled too
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
router.delete("/:invoiceId", auth, async (req, res) => {
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

      // 🛡️ CHECK: Edit Previous Day Permission
      if (req.user.role !== "SUPER_ADMIN" && !isToday(invoice.invoiceDate)) {
        if (req.user.actionPermissions?.editPreviousDay === false) {
          await session.abortTransaction();
          session.endSession();
          return res.status(403).json({ success: false, message: "Permission Denied: You cannot delete invoices from a previous day." });
        }
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

// Helper to generate Delivery Log ID (DL)
const generateDeliveryLogId = async (branchId) => {
  if (!mongoose.Types.ObjectId.isValid(branchId)) return null;

  const branch = await Branch.findById(branchId);
  const branchCode = branch?.code || "BR";
  const prefix = `DL-${branchCode}-`;

  // Find the last invoice with a DL ID for this branch
  const lastInvoice = await Invoice.findOne({
    branchId: new mongoose.Types.ObjectId(branchId),
    deliveryLogId: { $regex: `^${prefix}` }
  }).sort({ deliveryLogId: -1 });

  let nextNum = 1;
  if (lastInvoice && lastInvoice.deliveryLogId) {
    const parts = lastInvoice.deliveryLogId.split("-");
    const lastNum = parseInt(parts[parts.length - 1]);
    if (!isNaN(lastNum)) {
      nextNum = lastNum + 1;
    }
  }

  return `${prefix}${nextNum.toString().padStart(4, "0")}`;
};

// PATCH - Bulk update delivery flow fields for multiple invoices
router.patch("/delivery-flow/bulk", auth, async (req, res) => {
  try {
    const { invoiceIds, storageMan, storageManComment, stockChecker, stockCheckerComment, deliveryPerson, deliveryPersonComment, updatedBy, updatedById } = req.body;
    
    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return res.status(400).json({ success: false, message: "No invoices selected" });
    }

    const updateData = {};
    if (storageMan !== undefined) updateData.storageMan = storageMan;
    if (storageManComment !== undefined) updateData.storageManComment = storageManComment;
    if (stockChecker !== undefined) updateData.stockChecker = stockChecker;
    if (stockCheckerComment !== undefined) updateData.stockCheckerComment = stockCheckerComment;
    if (deliveryPerson !== undefined) updateData.deliveryPerson = deliveryPerson;
    if (deliveryPersonComment !== undefined) updateData.deliveryPersonComment = deliveryPersonComment;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, message: "No fields to update provided" });
    }

    const result = await Invoice.updateMany(
      { _id: { $in: invoiceIds } },
      { $set: updateData }
    );

    // Sync delivery person to SalesOrder/Invoice populated fields for each updated invoice
    if (deliveryPerson !== undefined && deliveryPerson !== "" && deliveryPerson !== "NONE") {
      const invoices = await Invoice.find({ _id: { $in: invoiceIds } });
      const firstPerson = deliveryPerson.split(',')[0].trim();
      
      for (const inv of invoices) {
         const dMan = await DeliveryMan.findOne({
            name: { $regex: new RegExp(`^${firstPerson}$`, 'i') },
            branchId: inv.branchId
         });
         if (dMan) {
            await SalesOrder.findByIdAndUpdate(inv.salesOrderId, { deliveryMan: dMan._id });
            await Invoice.findByIdAndUpdate(inv._id, { deliveryMan: dMan._id });
         }
      }
    } else if (deliveryPerson === "" || deliveryPerson === "NONE") {
      const invoices = await Invoice.find({ _id: { $in: invoiceIds } });
      for (const inv of invoices) {
         await SalesOrder.findByIdAndUpdate(inv.salesOrderId, { $unset: { deliveryMan: 1 } });
         await Invoice.findByIdAndUpdate(inv._id, { $unset: { deliveryMan: 1 } });
      }
    }

    await createAuditLog({
      userId: req.user.id,
      username: updatedBy || req.user.username,
      action: "BULK_UPDATE_DELIVERY_FLOW",
      description: `Bulk updated ${result.modifiedCount} invoices with assigned staff.`,
      targetModel: "Invoice"
    });

    res.json({ success: true, message: `${result.modifiedCount} invoices updated successfully` });
  } catch (error) {
    console.error("Error in bulk delivery update:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.patch("/:invoiceId/delivery-flow", async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const {
      area,
      storageMan,
      storageManComment,
      stockChecker,
      stockCheckerComment,
      deliveryPerson,
      deliveryPersonComment,
      deliveryStatus,
      updatedBy,
      updatedById,
      deliveryPaymentType,
      deliveryPaymentAmount,
      deliverySignature
    } = req.body;

    const inv = await Invoice.findById(invoiceId);
    if (!inv) return res.status(404).json({ success: false, message: "Invoice not found" });

    const updateData = {};
    if (area !== undefined) updateData.area = area;
    if (storageMan !== undefined) updateData.storageMan = storageMan;
    if (storageManComment !== undefined) updateData.storageManComment = storageManComment;
    if (stockChecker !== undefined) updateData.stockChecker = stockChecker;
    if (stockCheckerComment !== undefined) updateData.stockCheckerComment = stockCheckerComment;
    if (deliveryPerson !== undefined) updateData.deliveryPerson = deliveryPerson;
    if (deliveryPersonComment !== undefined) updateData.deliveryPersonComment = deliveryPersonComment;
    if (req.body.isReverted !== undefined) updateData.isReverted = req.body.isReverted;

    if (deliveryPaymentType !== undefined) updateData.deliveryPaymentType = deliveryPaymentType;
    if (deliveryPaymentAmount !== undefined) updateData.deliveryPaymentAmount = deliveryPaymentAmount;
    if (deliverySignature !== undefined) updateData.deliverySignature = deliverySignature;

    if (deliveryStatus !== undefined) {
      updateData.deliveryStatus = deliveryStatus;
      if (deliveryStatus === "COMPLETED") {
        updateData.deliveryCompletedAt = new Date();
        updateData.isReverted = false;
        if (!inv.deliveryLogId) {
          updateData.deliveryLogId = await generateDeliveryLogId(inv.branchId);
        }
      }
    }

    const invoice = await Invoice.findByIdAndUpdate(
      invoiceId,
      { $set: updateData },
      { new: true }
    );

    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    // ⚡ SYNC DELIVERY MAN TO SALES ORDER & INVOICE OBJECTID
    // If the delivery person name is updated, try to match it with a DeliveryMan record
    if (invoice.salesOrderId && deliveryPerson !== undefined) {
      if (!deliveryPerson || deliveryPerson === "NONE") {
        await SalesOrder.findByIdAndUpdate(invoice.salesOrderId, { $unset: { deliveryMan: 1 } });
        await Invoice.findByIdAndUpdate(invoice._id, { $unset: { deliveryMan: 1 } });
      } else {
        const dMan = await DeliveryMan.findOne({
          name: { $regex: new RegExp(`^${deliveryPerson}$`, 'i') },
          branchId: invoice.branchId
        });
        if (dMan) {
          await SalesOrder.findByIdAndUpdate(invoice.salesOrderId, { deliveryMan: dMan._id });
          await Invoice.findByIdAndUpdate(invoice._id, { deliveryMan: dMan._id });
        }
      }
    }

    // Optional: Log this action
    await createAuditLog({
      userId: mongoose.Types.ObjectId.isValid(updatedById) ? updatedById : invoice.branchId, // Use branchId as fallback if no valid userId
      username: updatedBy || "System",
      branchId: invoice.branchId,
      action: "UPDATE_DELIVERY_FLOW",
      description: `Updated delivery flow for Invoice: ${invoice.invoiceNumber}. Status: ${invoice.deliveryStatus}`,
      targetId: invoice._id,
      targetModel: "Invoice"
    });

    res.json({ success: true, data: invoice });
  } catch (error) {
    console.error("Error updating delivery flow:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

export default router;

