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
    const processedItems = items.map((item) => {
      const originalItem = salesOrder.items.find(
        (so) => so._id.toString() === item._id
      );
      if (!originalItem) return item;

      const confirmedQty = item.confirmedQty || item.qty;
      const qtyRatio = confirmedQty / originalItem.qty; // Calculate ratio for proportional calculation

      return {
        ...item,
        qty: confirmedQty,
        total: Math.round(originalItem.total * qtyRatio * 100) / 100,
      };
    });

    // Calculate back orders
    const backOrderItems = items
      .filter((item) => item.backOrderQty > 0)
      .map((item) => ({
        ...item,
        qty: item.backOrderQty,
      }));

    // Recalculate totals
    const subtotal = processedItems.reduce((sum, item) => sum + (item.total || 0), 0);
    const totalTax = {
      cgst: Math.round(
        processedItems.reduce((sum, item) => sum + (item.cgst || 0) * (item.qty / (salesOrder.items.find((o) => o._id.toString() === item._id)?.qty || 1)), 0) * 100
      ) / 100,
      sgst: Math.round(
        processedItems.reduce((sum, item) => sum + (item.sgst || 0) * (item.qty / (salesOrder.items.find((o) => o._id.toString() === item._id)?.qty || 1)), 0) * 100
      ) / 100,
      igst: 0,
    };
    totalTax.total = totalTax.cgst + totalTax.sgst + totalTax.igst;

    const grandTotal = subtotal + totalTax.total + (salesOrder.extraExpenseAmount || 0);

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
      const subtotal = processedItems.reduce((sum, item) => sum + (item.total || 0), 0);
      const totalTax = {
        cgst: Math.round(
          processedItems.reduce((sum, item) => sum + (item.cgst || 0) * (item.qty / (salesOrder.items.find((o) => o._id.toString() === item._id)?.qty || 1)), 0) * 100
        ) / 100,
        sgst: Math.round(
          processedItems.reduce((sum, item) => sum + (item.sgst || 0) * (item.qty / (salesOrder.items.find((o) => o._id.toString() === item._id)?.qty || 1)), 0) * 100
        ) / 100,
        igst: 0,
      };
      totalTax.total = totalTax.cgst + totalTax.sgst + totalTax.igst;

      const grandTotal = subtotal + totalTax.total + (salesOrder.extraExpenseAmount || 0);

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

      // Update product totalQty for each invoiced item
      for (const item of processedItems) {
        if (item.productId) {
          const product = await Product.findById(item.productId).session(session);
          if (product) {
            product.totalQty = (product.totalQty || 0) - (item.qty || 0);
            await product.save({ session });
          }
        }
      }

      // Update sales order
      salesOrder.invoiceGenerated = true;
      salesOrder.invoiceNotes = notes;
      await salesOrder.save({ session });

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

    const invoice = await Invoice.findByIdAndUpdate(
      invoiceId,
      {
        $inc: { printCount: 1 },
        status: "PRINTED",
      },
      { new: true }
    );

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
router.get("", async (req, res) => {
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
