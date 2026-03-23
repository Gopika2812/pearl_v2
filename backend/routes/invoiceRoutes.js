import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import cloudinary from "../config/cloudinary.js";
import Branch from "../models/Branch.js";
import Customer from "../models/Customer.js";
import Invoice from "../models/Invoice.js";
import Product from "../models/Product.js";
import SalesOrder from "../models/SalesOrder.js";
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
    const { items, notes, invoiceType = "ORDER_DETAILS" } = req.body;

    const salesOrder = await SalesOrder.findById(salesOrderId)
      .populate("branchId")
      .populate("customer.customerId");

    if (!salesOrder) {
      return res.status(404).json({ message: "Sales order not found" });
    }

    // Recalculate totals with edited quantities
    // ⚠️ NOTE: item.total already INCLUDES tax, we need to extract pre-tax amount
    
    let subtotal = 0;
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

      const gstPercent = item.gst || 0;
      const cgstPercent = item.cgst || 0;
      const sgstPercent = item.sgst || 0;
      const igstPercent = item.igst || 0;

      // Extract pre-tax amount
      const gstFactor = 1 + (gstPercent / 100);
      const preTaxAmount = Math.round((itemTotalWithTax / gstFactor) * 100) / 100;

      subtotal += preTaxAmount;

      // Calculate tax components
      const cgstAmount = Math.round((preTaxAmount * cgstPercent / 100) * 100) / 100;
      const sgstAmount = Math.round((preTaxAmount * sgstPercent / 100) * 100) / 100;
      const igstAmount = Math.round((preTaxAmount * igstPercent / 100) * 100) / 100;

      cgstTotal += cgstAmount;
      sgstTotal += sgstAmount;
      igstTotal += igstAmount;

      return {
        ...originalItem.toObject(),
        qty: confirmedQty,
        total: itemTotalWithTax,
      };
    });

    const backOrderItems = items
      .filter((item) => item.backOrderQty > 0)
      .map((item) => ({
        ...item,
        qty: item.backOrderQty,
      }));

    // Use the calculated totals from above
    const totalTax = {
      cgst: Math.round(cgstTotal * 100) / 100,
      sgst: Math.round(sgstTotal * 100) / 100,
      igst: Math.round(igstTotal * 100) / 100,
    };
    totalTax.total = totalTax.cgst + totalTax.sgst + totalTax.igst;

    const grandTotal = Math.round(subtotal + totalTax.total + (salesOrder.extraExpenseAmount || 0));

    const previewData = {
      invoiceNumber: salesOrder.invoiceId, // Use Sales Order's invoiceId
      salesOrderId,
      customer: salesOrder.customer,
      seller: {
        name: salesOrder.branchId?.name || "PEARL AGENCY",
        address: "12/13, South By-Pass Road, Vanarpettai, Tirunelveli - 627003",
        state: "Tamil Nadu",
        pincode: "627003",
        gstin: "33DULPS2600Q1Z6",
        phone: "9429692970",
        gpayNo: "8825847884",
        stateCode: "33",
      },
      items: recalculatedItems,
      backOrderItems,
      sampleItems: salesOrder.sampleItems || [],
      subtotal,
      totalTax,
      transportCharge: salesOrder.transportCharge || 0,
      extraExpenses: salesOrder.extraExpenses || [],
      extraExpenseAmount: salesOrder.extraExpenseAmount || 0,
      grandTotal,
      openingBalance: salesOrder.openingBalance || 0,
      closingBalance: (salesOrder.openingBalance || 0) + grandTotal,
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
    const { items, notes, invoiceType = "ORDER_DETAILS" } = req.body;

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

      // Use Sales Order's invoiceId as invoice number
      const invoiceNumber = salesOrder.invoiceId;
      const financialYear = getFinancialYear();

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
      
      let subtotal = 0;
      let cgstTotal = 0;
      let sgstTotal = 0;
      let igstTotal = 0;

      processedItems.forEach((item) => {
        const gstPercent = item.gst || 0;
        const cgstPercent = item.cgst || 0;
        const sgstPercent = item.sgst || 0;
        const igstPercent = item.igst || 0;

        // Extract pre-tax amount: preTax = itemTotal / (1 + gst/100)
        const itemTotalWithTax = item.total || 0;
        const gstFactor = 1 + (gstPercent / 100);
        const preTaxAmount = Math.round((itemTotalWithTax / gstFactor) * 100) / 100;

        subtotal += preTaxAmount;

        // Calculate tax components
        const cgstAmount = Math.round((preTaxAmount * cgstPercent / 100) * 100) / 100;
        const sgstAmount = Math.round((preTaxAmount * sgstPercent / 100) * 100) / 100;
        const igstAmount = Math.round((preTaxAmount * igstPercent / 100) * 100) / 100;

        cgstTotal += cgstAmount;
        sgstTotal += sgstAmount;
        igstTotal += igstAmount;
      });

      const totalTax = {
        cgst: Math.round(cgstTotal * 100) / 100,
        sgst: Math.round(sgstTotal * 100) / 100,
        igst: Math.round(igstTotal * 100) / 100,
      };
      totalTax.total = totalTax.cgst + totalTax.sgst + totalTax.igst;

      const grandTotal = Math.round(subtotal + totalTax.total + (salesOrder.extraExpenseAmount || 0));

      // Create invoice
      const invoice = new Invoice({
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
          pincode: customer.pincode,
        },
        seller: {
          name: branch.name || "PEARL AGENCY",
          address: "12/13, South By-Pass Road, Vanarpettai, Tirunelveli - 627003",
          state: "Tamil Nadu",
          pincode: "627003",
          gstin: "33DULPS2600Q1Z6",
          phone: "9429692970",
          gpayNo: "8825847884",
          stateCode: "33",
        },
        items: processedItems,
        backOrderItems,
        sampleItems: salesOrder.sampleItems || [],
        subtotal,
        totalTax,
        transportCharge: salesOrder.transportCharge || 0,
        extraExpenses: salesOrder.extraExpenses || [],
        extraExpenseAmount: salesOrder.extraExpenseAmount || 0,
        grandTotal,
        openingBalance: salesOrder.openingBalance || 0,
        closingBalance: (salesOrder.openingBalance || 0) + grandTotal,
        invoiceNotes: notes,
        invoiceType,
        status: "FINALIZED",
      });

      await invoice.save({ session });

      // Log Invoice Finalization
      await createAuditLog({
        userId: req.body.finalizedBy || invoice.billingPerson || "System",
        username: req.body.finalizedByUsername || invoice.billingPerson || "System",
        branchId: invoice.branchId,
        action: "FINALIZE_INVOICE",
        description: `Finalized Invoice: ${invoice.invoiceNumber}. Amount: ₹${invoice.grandTotal}`,
        targetId: invoice._id,
        targetModel: "Invoice",
      });

      // Update product totalQty for each invoiced item
      for (const item of processedItems) {
        if (item.productId) {
          const product = await Product.findById(item.productId).session(session);
          if (product) {
            product.totalQty = (product.totalQty || 0) - (item.qty || 0);
            
            // ✅ RECALCULATE selling qty based on configured period
            if (product.restockingConfig?.salesPeriodDays) {
              const days = product.restockingConfig.salesPeriodDays;
              const endDate = new Date();
              const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

              // Query all invoices for this product in the period (including the one just created)
              const recentInvoices = await Invoice.find({
                branchId: salesOrder.branchId,
                invoiceDate: { $gte: startDate, $lte: endDate },
                "items.productId": item.productId,
              }).session(session).lean();

              // Sum total qty sold in period
              let totalSellingQty = 0;
              recentInvoices.forEach((inv) => {
                if (Array.isArray(inv.items)) {
                  inv.items.forEach((invItem) => {
                    const invItemProductId = invItem.productId?._id || invItem.productId;
                    if (invItemProductId && invItemProductId.toString() === item.productId.toString()) {
                      totalSellingQty += invItem.qty || 0;
                    }
                  });
                }
              });

              // Update restockingConfig with latest selling qty
              product.restockingConfig.sellingQtyInPeriod = totalSellingQty;
              
              // Also sync restockingQty to match for display
              product.restockingConfig.restockingQty = totalSellingQty;
              
              console.log(`✅ Updated product ${product.name}: selling qty in ${days} days = ${totalSellingQty}`);
            }
            
            await product.save({ session });
          }
        }
      }

      // Update sales order
      salesOrder.invoiceGenerated = true;
      salesOrder.invoiceNotes = notes;
      await salesOrder.save({ session });

      // ✅ Update customer's debit and closingBalance on INVOICE GENERATION ONLY
      // debit = closingBalance (they must always be equal)
      // Calculate total invoiced amount for this customer
      if (customer) {
        const allInvoices = await Invoice.find({
          "customer.customerId": customer._id,
          status: "FINALIZED"
        }).session(session);

        // Sum all invoice grand totals
        const totalInvoiced = allInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
        const newDebit = Math.round(totalInvoiced);

        customer.debit = newDebit;
        customer.closingBalance = newDebit; // ✅ Keep them EQUAL
        await customer.save({ session });

        console.log(`✅ Customer ${customer.name} debit updated: ₹${newDebit}`);
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
    console.error("Error finalizing invoice:", error);
    res.status(500).json({ message: "Failed to finalize invoice" });
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

// GET - Get all invoices for a branch
// GET sales invoices with pagination and filtering (Sales Reports)
router.get("", async (req, res) => {
  try {
    const { branchId, page = 1, limit = 100, search } = req.query;

    const query = {};
    if (branchId) query.branchId = branchId;

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
      .limit(parseInt(limit));

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

export default router;
