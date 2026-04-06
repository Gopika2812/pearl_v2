import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import cloudinary from "../config/cloudinary.js";
import Branch from "../models/Branch.js";
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
import Ledger from "../models/Ledger.js";
import LedgerGroup from "../models/LedgerGroup.js";


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
      finalizedBy, 
      finalizedByUsername 
    } = req.body;

    const salesOrder = await SalesOrder.findById(salesOrderId)
      .populate("branchId")
      .populate("customer.customerId");

    if (!salesOrder) {
      return res.status(404).json({ message: "Sales order not found" });
    }

    // Recalculate totals with edited quantities
    // ⚠️ NOTE: item.total already INCLUDES tax, we need to extract pre-tax amount
    
    let grossSubtotal = 0;
    let totalItemDiscount = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;

    const recalculatedItems = items.map((item) => {
      const originalItem = salesOrder.items.find(
        (so) => so._id.toString() === item._id
      );
      if (!originalItem) return item;

      const confirmedQty = item.confirmedQty || item.qty;
      const qtyRatio = confirmedQty / originalItem.qty;

      // Original item.total already has tax, so scale it proportionally
      const itemTotalWithTax = Math.round(originalItem.total * qtyRatio * 100) / 100;
      
      // Values for Gross Subtotal
      const itemSellingPrice = originalItem.sellingPrice || 0;
      const itemGrossAmount = Math.round(itemSellingPrice * confirmedQty * 100) / 100;
      grossSubtotal += itemGrossAmount;

      const gstPercent = item.gst || 0;
      const cgstPercent = item.cgst || 0;
      const sgstPercent = item.sgst || 0;
      const igstPercent = item.igst || 0;

      // Extract pre-tax amount (Taxable Value)
      const gstFactor = 1 + (gstPercent / 100);
      const taxableAmount = Math.round((itemTotalWithTax / gstFactor) * 100) / 100;

      // Calculate item discount relative to gross
      const itemDiscount = Math.round((itemGrossAmount - taxableAmount) * 100) / 100;
      totalItemDiscount += itemDiscount;

      // Calculate tax components from taxableAmount
      const cgstAmount = Math.round((taxableAmount * cgstPercent / 100) * 100) / 100;
      const sgstAmount = Math.round((taxableAmount * sgstPercent / 100) * 100) / 100;
      const igstAmount = Math.round((taxableAmount * igstPercent / 100) * 100) / 100;

      cgstTotal += cgstAmount;
      sgstTotal += sgstAmount;
      igstTotal += igstAmount;

      return {
        ...originalItem.toObject(),
        qty: confirmedQty,
        altQty: originalItem.altQty ? Math.round(originalItem.altQty * qtyRatio) : 0,
        total: itemTotalWithTax,
      };
    });

    const backOrderItems = items
      .filter((item) => item.backOrderQty > 0)
      .map((item) => ({
        ...item,
        qty: item.backOrderQty,
      }));

    // Transport GST calculation
    const tCharge = salesOrder.transportCharge || 0;
    const tGstPercent = salesOrder.transportGstPercent || 0;
    const tGstAmount = Math.round((tCharge * tGstPercent / 100) * 100) / 100;

    // Use the calculated totals from above and add transport GST
    const totalTax = {
      cgst: Math.round((cgstTotal + (igstTotal === 0 ? tGstAmount / 2 : 0)) * 100) / 100,
      sgst: Math.round((sgstTotal + (igstTotal === 0 ? tGstAmount / 2 : 0)) * 100) / 100,
      igst: Math.round((igstTotal + (igstTotal > 0 ? tGstAmount : 0)) * 100) / 100,
    };
    totalTax.total = totalTax.cgst + totalTax.sgst + totalTax.igst;

    const commonDiscount = customCommonDiscount !== undefined 
      ? Number(customCommonDiscount) 
      : (salesOrder.commonDiscount || 0);
    const grandTotal = Math.round(grossSubtotal - totalItemDiscount + totalTax.total + (salesOrder.extraExpenseAmount || 0) + (salesOrder.transportCharge || 0) - commonDiscount);

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

    // Calculate dynamic opening balance from current customer state
    const currentCustomer = salesOrder.customer?.customerId;
    let dynamicOpeningBalance = 0;
    
    if (currentCustomer) {
      const actualBalance = (currentCustomer.debit || 0) - (currentCustomer.credit || 0);
      
      // If it's a re-edit (already invoiced once), the current balance already includes the last invoice amount.
      // So opening balance (before this invoice) = current balance - last grand total.
      if (salesOrder.invoiceGenerated) {
        dynamicOpeningBalance = actualBalance - (salesOrder.lastInvoicedGrandTotal || 0);
      } else {
        dynamicOpeningBalance = actualBalance;
      }
    } else {
      dynamicOpeningBalance = salesOrder.openingBalance || 0;
    }

    const previewData = {
      invoiceNumber: salesOrder.invoiceId, // Use Sales Order's invoiceId
      salesOrderId,
      billingPerson: billingPersonName,
      deliveryMan: deliveryManName,
      customer: salesOrder.customer,
      seller: {
        name: salesOrder.branchId?.name || "PEARL AGENCY",
        address: salesOrder.branchId?.address || "12/13, South By-Pass Road, Vanarpettai, Tirunelveli - 627003",
        state: salesOrder.branchId?.state || "Tamil Nadu",
        pincode: salesOrder.branchId?.pincode || "627003",
        gstin: salesOrder.branchId?.gstin || "33DULPS2600Q1Z6",
        phone: salesOrder.branchId?.phone || "9429692970",
        gpayNo: salesOrder.branchId?.gpayNo || "",
        stateCode: salesOrder.branchId?.stateCode || "33",
        logo: salesOrder.branchId?.logo || "/logo.jpeg",
      },
      items: recalculatedItems,
      backOrderItems,
      sampleItems: salesOrder.sampleItems || [],
      subtotal: grossSubtotal,
      totalDiscount: totalItemDiscount,
      totalTax,
      transportCharge: tCharge,
      transportGstPercent: tGstPercent,
      transportGstAmount: tGstAmount,
      extraExpenses: salesOrder.extraExpenses || [],
      extraExpenseAmount: salesOrder.extraExpenseAmount || 0,
      commonDiscount: commonDiscount,
      grandTotal: grandTotal,
      openingBalance: dynamicOpeningBalance,
      closingBalance: dynamicOpeningBalance + grandTotal,
      notes,
      invoiceType,
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
      finalizedBy, 
      finalizedByUsername 
    } = req.body;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const salesOrder = await SalesOrder.findById(salesOrderId).session(session);

      if (!salesOrder) {
        await session.abortTransaction();
        return res.status(404).json({ message: "Sales order not found" });
      }

      const branch = await Branch.findById(salesOrder.branchId).session(session);
      const customer = await Customer.findById(
        salesOrder.customer.customerId
      ).session(session);

      let oldCustomerId = null;
      let needsOldCustomerRecalculation = false;

      const financialYear = getFinancialYear();

      // 🏁 Check if invoice already exists for this ORDER (to preserve numbering on re-edit)
      let invoice = await Invoice.findOne({ salesOrderId: salesOrder._id }).session(session);
      let invoiceNumber;

      if (invoice) {
        invoiceNumber = invoice.invoiceNumber;
        console.log(`♻️ Reusing existing Invoice Number: ${invoiceNumber} for SO: ${salesOrder.invoiceId}`);
      } else {
        // 🆕 ABSOLUTE PREFIX SYNC: Derive SI ID 100% from SO ID Prefix (e.g., LOCALLINESSO -> LOCALLINESSI)
        const rawSoId = salesOrder.invoiceId || "";
        // Stronger regex to strip "SO REF: ", "SO: ", "SO-", etc.
        const cleanSoId = rawSoId.replace(/^(SO|SO REF|SO\sREF)[:\s\-]*/i, ""); 
        const soPrefixPrefix = cleanSoId.split('/')[0]; 
        
        // Replace trailing SO with SI, or just append SI if not present
        let siPrefix = soPrefixPrefix.endsWith("SO") 
          ? soPrefixPrefix.replace(/SO$/i, "SI")
          : `${soPrefixPrefix}SI`;

        console.log(`🔍 Absolute Sync (Finalize): SO [${soPrefixPrefix}] -> Target SI [${siPrefix}]`);

        // Generate NEW sequential SI number
        let siVoucher = await VoucherType.findOne({
          branchId: salesOrder.branchId,
          prefix: siPrefix,
          orderType: "SI",
          financialYear
        }).session(session);

        // 🆕 AUTO-CREATE SI VOUCHER IF MISSING
        if (!siVoucher) {
          console.log(`⚠️ No SI voucher found for prefix '${siPrefix}'. Auto-creating now...`);
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

        invoiceNumber = `${siVoucher.prefix}/${String(siVoucher.counter).padStart(3, "0")}/${financialYear}`;
        
        // Increment SI counter
        siVoucher.counter += 1;
        await siVoucher.save({ session });
        console.log(`✨ Generated NEW Independent Invoice Number: ${invoiceNumber} for SO: ${salesOrder.invoiceId}`);
      }

      // 🛡️ INVOICE NUMBER LENGTH VALIDATION (GST/E-INVOICE COMPATIBILITY)
      if (invoiceNumber.length > 16) {
        await session.abortTransaction();
        return res.status(400).json({ 
          message: `Generated Invoice Number "${invoiceNumber}" is too long (${invoiceNumber.length} chars). Max 16 allowed for E-Invoicing. Please shorten the Voucher Prefix.` 
        });
      }


      // Process items
      const processedItems = items.map((item) => {
        const originalItem = salesOrder.items.find(
          (so) => so._id.toString() === item._id
        );
        if (!originalItem) return item;

        const confirmedQty = item.confirmedQty || item.qty;
        const qtyRatio = confirmedQty / originalItem.qty;

        return {
          ...originalItem.toObject(),
          qty: confirmedQty,
          altQty: originalItem.altQty ? Math.round(originalItem.altQty * qtyRatio) : 0,
          total: Math.round(originalItem.total * qtyRatio * 100) / 100,
        };
      });

      // Calculate back orders
      const backOrderItems = items
        .filter((item) => item.backOrderQty > 0)
        .map((item) => {
          const originalItem = salesOrder.items.find(
            (so) => so._id.toString() === item._id
          );
          return {
            ...originalItem.toObject(),
            qty: item.backOrderQty,
          };
        });

      // Calculate totals
      // ⚠️ NOTE: item.total already INCLUDES tax (calculated as pre_tax × (1 + gst/100))
      // We need to extract the pre-tax amount and recalculate tax properly
      
      let grossSubtotal = 0;
      let totalItemDiscount = 0;
      let cgstTotal = 0;
      let sgstTotal = 0;
      let igstTotal = 0;

      processedItems.forEach((item) => {
        const gstPercent = item.gst || 0;
        const cgstPercent = item.cgst || 0;
        const sgstPercent = item.sgst || 0;
        const igstPercent = item.igst || 0;

        // Extract pre-tax amount (Taxable Value): preTax = itemTotal / (1 + gst/100)
        const itemTotalWithTax = item.total || 0;
        const gstFactor = 1 + (gstPercent / 100);
        const taxableAmount = Math.round((itemTotalWithTax / gstFactor) * 100) / 100;

        // Gross addition
        const itemSellingPrice = item.sellingPrice || 0;
        const itemGrossAmount = Math.round(itemSellingPrice * item.qty * 100) / 100;
        grossSubtotal += itemGrossAmount;

        // Discount addition
        totalItemDiscount += Math.round((itemGrossAmount - taxableAmount) * 100) / 100;

        // Calculate tax components from taxableAmount
        const cgstAmount = Math.round((taxableAmount * cgstPercent / 100) * 100) / 100;
        const sgstAmount = Math.round((taxableAmount * sgstPercent / 100) * 100) / 100;
        const igstAmount = Math.round((taxableAmount * igstPercent / 100) * 100) / 100;

        cgstTotal += cgstAmount;
        sgstTotal += sgstAmount;
        igstTotal += igstAmount;
      });

      const tCharge = salesOrder.transportCharge || 0;
      const tGstPercent = salesOrder.transportGstPercent || 0;
      const tGstAmount = Math.round((tCharge * tGstPercent / 100) * 100) / 100;

      const totalTax = {
        cgst: Math.round((cgstTotal + (igstTotal === 0 ? tGstAmount / 2 : 0)) * 100) / 100,
        sgst: Math.round((sgstTotal + (igstTotal === 0 ? tGstAmount / 2 : 0)) * 100) / 100,
        igst: Math.round((igstTotal + (igstTotal > 0 ? tGstAmount : 0)) * 100) / 100,
      };
      totalTax.total = totalTax.cgst + totalTax.sgst + totalTax.igst;

      const commonDiscount = customCommonDiscount !== undefined 
        ? Number(customCommonDiscount) 
        : (salesOrder.commonDiscount || 0);
      
      const grandTotal = Math.round(grossSubtotal - totalItemDiscount + totalTax.total + (salesOrder.extraExpenseAmount || 0) + tCharge - commonDiscount);

      // Note: We already found the invoice object above if it exists

      if (invoice) {
        // 🏁 Detect if customer is being changed on an existing invoice
        if (invoice.customer?.customerId && invoice.customer.customerId.toString() !== customer._id.toString()) {
          oldCustomerId = invoice.customer.customerId;
          needsOldCustomerRecalculation = true;
          console.log(`⚠️ Invoice customer change detected: ${invoice.customer.name} -> ${customer.name}`);
        }

        // Calculate dynamic opening balance
        const actualBalance = (customer.debit || 0) - (customer.credit || 0);
        let dynamicOpeningBalance = 0;
        
        if (salesOrder.invoiceGenerated) {
          dynamicOpeningBalance = actualBalance - (salesOrder.lastInvoicedGrandTotal || 0);
        } else {
          dynamicOpeningBalance = actualBalance;
        }

        invoice.invoiceDate = new Date();
        // Update customer details on the invoice itself
        invoice.customer = {
          customerId: customer._id,
          name: customer.name,
          whatsapp: customer.whatsapp,
          address: customer.address,
          district: customer.district,
          state: customer.state,
          pincode: customer.pincode,
        };
        invoice.items = processedItems;
        invoice.backOrderItems = backOrderItems;
        invoice.sampleItems = salesOrder.sampleItems || [];
        invoice.subtotal = grossSubtotal;
        invoice.totalDiscount = totalItemDiscount;
        invoice.totalTax = totalTax;
        invoice.transportCharge = tCharge;
        invoice.transportGstPercent = tGstPercent;
        invoice.transportGstAmount = tGstAmount;
        invoice.extraExpenses = salesOrder.extraExpenses || [],
        invoice.extraExpenseAmount = salesOrder.extraExpenseAmount || 0;
        invoice.commonDiscount = commonDiscount;
        invoice.grandTotal = grandTotal;
        invoice.openingBalance = dynamicOpeningBalance;
        invoice.closingBalance = dynamicOpeningBalance + grandTotal;
        invoice.invoiceNotes = notes;
        invoice.invoiceType = invoiceType;
        invoice.status = "FINALIZED";
        
        await invoice.save({ session });
      } else {
        // Calculate dynamic opening balance
        const actualBalance = (customer.debit || 0) - (customer.credit || 0);
        
        // ✨ Create new invoice if it doesn't exist
        invoice = new Invoice({
          invoiceNumber,
          invoiceDate: new Date(),
          financialYear,
          salesOrderId: salesOrder._id,
          branchId: salesOrder.branchId,
          warehouse: salesOrder.warehouse,
          billingPerson: salesOrder.billingPerson,
          deliveryPerson: salesOrder.deliveryMan,
          customer: {
            customerId: customer._id,
            name: customer.name,
            whatsapp: customer.whatsapp,
            address: customer.address,
            district: customer.district,
            state: customer.state,
            stateCode: customer.stateCode || "33", // ✨ NEW: Capture customer state code for E-Invoice
            pincode: customer.pincode,
            gstin: customer.gstin, // ✨ NEW: Capture customer GSTIN for E-Invoice
          },
          seller: {
            name: branch?.name || "PEARL AGENCY",
            address: branch?.address || "12/13, South By-Pass Road, Vanarpettai, Tirunelveli - 627003",
            state: branch?.state || "Tamil Nadu",
            pincode: branch?.pincode || "627003",
            gstin: branch?.gstin || "33DULPS2600Q1Z6",
            phone: branch?.phone || "9429692970",
            gpayNo: branch?.gpayNo || branch?.phone || "",
            stateCode: branch?.stateCode || "33",
            logo: branch?.logo || "/logo.jpeg",
          },
          items: processedItems,
          backOrderItems,
          sampleItems: salesOrder.sampleItems || [],
          subtotal: grossSubtotal,
          totalItemDiscount: totalItemDiscount,
          totalTax,
          transportCharge: tCharge,
          transportGstPercent: tGstPercent,
          transportGstAmount: tGstAmount,
          extraExpenses: salesOrder.extraExpenses || [],
          extraExpenseAmount: salesOrder.extraExpenseAmount || 0,
          commonDiscount,
          grandTotal,
          openingBalance: actualBalance,
          closingBalance: actualBalance + grandTotal,
          invoiceNotes: notes,
          invoiceType,
          status: "FINALIZED",
        });
        
        await invoice.save({ session });
      }

      // Log Invoice Finalization
      await createAuditLog({
        userId: req.body.finalizedBy || req.body.userId || invoice.billingPerson || "System",
        username: req.body.finalizedByUsername || req.body.username || "System",
        branchId: invoice.branchId,
        action: "FINALIZE_INVOICE",
        description: `Finalized Invoice: ${invoice.invoiceNumber}. Amount: ₹${invoice.grandTotal}`,
        targetId: invoice._id,
        targetModel: "Invoice",
      });

      // 🔄 DELTA-BASED STOCK UPDATE 🔄
      // We calculate the difference between NEW items and LAST INVOICED items
      const lastItems = salesOrder.lastInvoicedItems || [];
      const allProductIds = new Set([
        ...processedItems.map(i => i.productId.toString()),
        ...lastItems.map(i => i.productId.toString())
      ]);

      for (const pId of allProductIds) {
        const newItem = processedItems.find(i => i.productId.toString() === pId);
        const oldItem = lastItems.find(i => i.productId.toString() === pId);

        const newQty = newItem?.qty || 0;
        const oldQty = oldItem?.qty || 0;
        const deltaQty = newQty - oldQty;

        if (deltaQty !== 0) {
          const product = await Product.findById(pId).session(session);
          if (product) {
            product.totalQty = (product.totalQty || 0) - deltaQty;
            
            // ✅ RECALCULATE selling qty based on configured period (Optional but kept for compatibility)
            if (product.restockingConfig?.salesPeriodDays) {
              const days = product.restockingConfig.salesPeriodDays;
              const endDate = new Date();
              const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
              const recentInvoices = await Invoice.find({
                branchId: salesOrder.branchId,
                invoiceDate: { $gte: startDate, $lte: endDate },
                "items.productId": pId,
              }).session(session).lean();

              let totalSellingQty = 0;
              recentInvoices.forEach((inv) => {
                inv.items.forEach((invItem) => {
                  if (invItem.productId?.toString() === pId.toString()) {
                    totalSellingQty += invItem.qty || 0;
                  }
                });
              });
              product.restockingConfig.sellingQtyInPeriod = totalSellingQty;
              product.restockingConfig.restockingQty = totalSellingQty;
            }
            await product.save({ session });
            console.log(`📦 Stock Delta for ${product.name}: ${-deltaQty} (New: ${newQty}, Old: ${oldQty})`);
          }
        }
      }

      // 💰 DELTA-BASED CUSTOMER BALANCE UPDATE (With Customer Swap Support) 💰
      const lastGrandTotal = salesOrder.lastInvoicedGrandTotal || 0;
      const lastCustomerId = salesOrder.lastInvoicedCustomerId || (invoice ? invoice.customer?.customerId : salesOrder.customer?.customerId);
      const currentCustomerId = customer._id;
      const isCustomerSwapped = lastCustomerId && currentCustomerId && lastCustomerId.toString() !== currentCustomerId.toString();

      if (isCustomerSwapped) {
        console.log(`🔄 Customer Swap detected during finalization: ${lastCustomerId} -> ${currentCustomerId}`);
        
        // A. Revert old total from previous customer
        const oldCustomerObj = await Customer.findById(lastCustomerId).session(session);
        if (oldCustomerObj) {
          let remainingToRevert = lastGrandTotal;
          let oldDebit = oldCustomerObj.debit || 0;
          let oldCredit = oldCustomerObj.credit || 0;

          if (oldDebit >= remainingToRevert) {
            oldDebit -= remainingToRevert;
          } else {
            remainingToRevert -= oldDebit;
            oldDebit = 0;
            oldCredit += remainingToRevert;
          }

          oldCustomerObj.debit = Math.round(oldDebit);
          oldCustomerObj.credit = Math.round(oldCredit);
          oldCustomerObj.closingBalance = Math.round((oldCustomerObj.closingBalance || 0) - lastGrandTotal);
          oldCustomerObj.totalBalance = oldCustomerObj.closingBalance;
          await oldCustomerObj.save({ session });
          console.log(`✅ Old customer (${oldCustomerObj.name}) balance reverted: -₹${lastGrandTotal}`);
        }

        // B. Apply entire new total to current customer
        let remainingToAdd = grandTotal;
        let curDebit = customer.debit || 0;
        let curCredit = customer.credit || 0;

        if (curCredit >= remainingToAdd) {
          curCredit -= remainingToAdd;
        } else {
          remainingToAdd -= curCredit;
          curCredit = 0;
          curDebit += remainingToAdd;
        }

        customer.debit = Math.round(curDebit);
        customer.credit = Math.round(curCredit);
        customer.closingBalance = Math.round((customer.closingBalance || 0) + grandTotal);
        customer.totalBalance = customer.closingBalance;
        await customer.save({ session });
        console.log(`✅ Current customer (${customer.name}) balance updated: +₹${grandTotal}`);
      } else {
        // Standard Delta for same customer
        const totalDelta = grandTotal - lastGrandTotal;
        if (totalDelta !== 0) {
          let remainingDelta = totalDelta;
          let curDebit = customer.debit || 0;
          let curCredit = customer.credit || 0;

          if (totalDelta > 0) {
            // Addition: Consume credit first
            if (curCredit >= remainingDelta) {
              curCredit -= remainingDelta;
              remainingDelta = 0;
            } else {
              remainingDelta -= curCredit;
              curCredit = 0;
              curDebit += remainingDelta;
            }
          } else {
            // Reduction: Consume debit first
            const absDelta = Math.abs(remainingDelta);
            if (curDebit >= absDelta) {
              curDebit -= absDelta;
            } else {
              const excess = absDelta - curDebit;
              curDebit = 0;
              curCredit += excess;
            }
          }

          customer.debit = Math.round(curDebit);
          customer.credit = Math.round(curCredit);
          customer.closingBalance = Math.round((customer.closingBalance || 0) + totalDelta);
          customer.totalBalance = customer.closingBalance;
          await customer.save({ session });
          console.log(`💰 Balance Delta for ${customer.name}: ₹${totalDelta} (New: ₹${grandTotal}, Old: ₹${lastGrandTotal})`);
        }
      }

      // Update sales order
      salesOrder.invoiceGenerated = true;
      salesOrder.status = "INVOICED";
      salesOrder.invoiceNotes = notes;
      salesOrder.salesInvoiceId = invoiceNumber; 
      salesOrder.recordType = "SALES INVOICE";
      
      // Save snapshot in history
      salesOrder.editHistory.push({
        version: (salesOrder.editHistory.length || 0) + 1,
        editType: (salesOrder.editHistory.length === 0) ? 'INVOICED' : 'RE_INVOICED',
        items: processedItems,
        subtotal: grossSubtotal,
        totalTax: totalTax,
        grandTotal: grandTotal,
        editedAt: new Date(),
        note: `Sales Invoice ${invoiceNumber} finalized. ${isCustomerSwapped ? 'Customer Swap Applied.' : 'Balance Delta Applied.'}`
      });

      // Update delta references for next time
      salesOrder.lastInvoicedItems = processedItems;
      salesOrder.lastInvoicedGrandTotal = grandTotal;
      salesOrder.lastInvoicedCustomerId = customer._id;

      await salesOrder.save({ session });

      // ♻️ Handle OLD Customer Redistribution
      if (needsOldCustomerRecalculation && oldCustomerId) {
        const oldCustomer = await Customer.findById(oldCustomerId).session(session);
        if (oldCustomer) {
          const oldCustomerInvoices = await Invoice.find({
            "customer.customerId": oldCustomerId,
            status: "FINALIZED"
          }).session(session);
          
          const oldCustomerTotalInvoiced = oldCustomerInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
          const oldCustomerNewDebit = Math.round(oldCustomerTotalInvoiced);
          
          oldCustomer.debit = oldCustomerNewDebit;
          oldCustomer.closingBalance = oldCustomerNewDebit;
          await oldCustomer.save({ session });
          
          console.log(`♻️ Old customer ${oldCustomer.name} balance recalculated after transfer: ₹${oldCustomerNewDebit}`);
        }
      }

      // 📊 AUTOMATED LEDGER POSTING (Sales)
      const salesAccountGroup = await LedgerGroup.findOneAndUpdate(
        { branchId: invoice.branchId, name: "Sales Accounts" },
        { $setOnInsert: { nature: "Income" } },
        { upsert: true, new: true, session }
      );

      // Group items by GST% to post to corresponding ledgers
      const gstSlabs = {};
      invoice.items.forEach(item => {
        const gst = item.gst || 0;
        const gstFactor = 1 + (gst / 100);
        const taxableValue = Math.round((item.total / gstFactor) * 100) / 100;
        gstSlabs[gst] = (gstSlabs[gst] || 0) + taxableValue;
      });

      for (const [gst, amount] of Object.entries(gstSlabs)) {
        const ledgerName = `Sales ${gst}%`;
        await Ledger.findOneAndUpdate(
          { branchId: invoice.branchId, name: ledgerName, groupId: salesAccountGroup._id },
          { $inc: { currentBalance: amount } }, // Incomes increase with Credit, but here we track simple balance
          { upsert: true, session }
        );
      }

      await session.commitTransaction();


      res.json({
        success: true,
        invoice: {
          _id: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          invoiceType: invoice.invoiceType,
          grandTotal: invoice.grandTotal,
          closingBalance: invoice.closingBalance,
        },
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  } catch (error) {
    console.error("❌ Error finalizing invoice:", error);
    
    // Catch Mongoose Validation Errors (e.g., HSN length, Invoice Number length)
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ message: `Validation Error: ${messages.join(', ')}` });
    }

    res.status(500).json({ message: error.message || "Failed to finalize invoice" });
  }
});

// GET - Retrieve invoice data for display/printing
router.get("/:invoiceId", async (req, res) => {
  try {
    const { invoiceId } = req.params;

    const invoice = await Invoice.findById(invoiceId)
      .populate("salesOrderId")
      .populate("branchId")
      .populate("customer.customerId");

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    res.json(invoice);
  } catch (error) {
    console.error("Error fetching invoice:", error);
    res.status(500).json({ message: "Failed to fetch invoice" });
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

// GET - Get all invoices for a branch
// GET sales invoices with pagination and filtering (Sales Reports)
router.get("", async (req, res) => {
  try {
    const { branchId, page = 1, limit = 100, search } = req.query;

    const query = {};
    if (branchId) {
      query.$or = [{ branchId }, { branchId: { $exists: false } }];
    }

    // Search by customer name or invoice number
    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: "i" } },
        { "customer.name": { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const invoices = await Invoice.find(query)
      .populate("customer.customerId", "name whatsapp")
      .populate("salesOrderId")
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

// DELETE - Delete invoice and revert all changes (Stock & Balance)
router.delete("/:invoiceId", async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { invoiceId } = req.params;
    const { deletedBy, deletedByUsername } = req.query;

    const invoice = await Invoice.findById(invoiceId).session(session);
    if (!invoice) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Invoice not found" });
    }

    const salesOrder = await SalesOrder.findById(invoice.salesOrderId).session(session);
    const customer = await Customer.findById(invoice.customer?.customerId).session(session);

    // 1. REVERT STOCK (Put back the items)
    for (const item of invoice.items) {
      const product = await Product.findById(item.productId).session(session);
      if (product) {
        product.totalQty = (product.totalQty || 0) + (item.qty || 0);
        await product.save({ session });
        console.log(`📦 Reverted Stock for ${product.name}: +${item.qty}`);
      }
    }

    // 2. REVERT CUSTOMER BALANCE
    if (customer && invoice.grandTotal > 0) {
      customer.debit = Math.round((customer.debit || 0) - invoice.grandTotal);
      customer.closingBalance = Math.round((customer.closingBalance || 0) - invoice.grandTotal);
      await customer.save({ session });
      console.log(`💰 Reverted Balance for ${customer.name}: -₹${invoice.grandTotal}`);
    }

    // 3. RESET SALES ORDER
    if (salesOrder) {
      salesOrder.status = "PENDING";
      salesOrder.invoiceGenerated = false;
      salesOrder.salesInvoiceId = null; // CLEAR THE SI LINK
      salesOrder.lastInvoicedItems = []; // CLEAR DELTA REF
      salesOrder.lastInvoicedGrandTotal = 0;
      salesOrder.recordType = "SALES ORDER"; // Revert type
      
      salesOrder.editHistory.push({
        version: (salesOrder.editHistory.length || 0) + 1,
        editType: 'INVOICE_CANCELLED',
        editedAt: new Date(),
        note: `Invoice ${invoice.invoiceNumber} was deleted. Status reset to PENDING and balances reverted.`
      });
      await salesOrder.save({ session });
    }

    // 4. Audit Log
    await createAuditLog({
      userId: deletedBy || "System",
      username: deletedByUsername || "System",
      branchId: invoice.branchId,
      action: "DELETE_INVOICE",
      description: `Deleted Invoice: ${invoice.invoiceNumber}. Reverted Stock & Balance.`,
      targetId: invoice._id,
      targetModel: "Invoice"
    });

    // 5. DELETE INVOICE DOCUMENT
    await Invoice.findByIdAndDelete(invoiceId).session(session);

    await session.commitTransaction();
    res.json({ success: true, message: "Invoice deleted and balances reverted successfully." });

  } catch (error) {
    await session.abortTransaction();
    console.error("Error deleting invoice:", error);
    res.status(500).json({ message: "Failed to delete invoice" });
  } finally {
    session.endSession();
  }
});

export default router;

