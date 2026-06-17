import express from "express";
import mongoose from "mongoose";
import PurchaseInvoice from "../models/PurchaseInvoice.js";
import { getFinancialYear } from "../utils/financialYear.js";

const router = express.Router();

// GET ALL PURCHASE INVOICES (Finalized Bills)
router.get("/", async (req, res) => {
  try {
    const { branchId, search, fromDate, toDate } = req.query;
    const query = {};
    if (branchId) query.branchId = branchId;

    // Filter by date range
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) {
        const start = new Date(fromDate);
        start.setHours(0, 0, 0, 0);
        query.createdAt.$gte = start;
      }
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    if (search) {
      query.$or = [
        { purchaseInvoiceId: { $regex: search, $options: "i" } },
        { vendor: { $regex: search, $options: "i" } },
        { "items.name": { $regex: search, $options: "i" } },
      ];
    }
    const invoices = await PurchaseInvoice.find(query).sort({ createdAt: -1 }).lean();
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET purchase invoice history (for Product Records - Purchase Mode)
router.get("/history", async (req, res) => {
  try {
    const { branchId, fromDate, toDate, productGroupId, productId, vendorSearch, page = 1, limit = 500, sortKey = 'date', sortDirection = 'desc' } = req.query;

    if (!branchId) {
      return res.status(400).json({ message: "branchId is required" });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const matchQuery = {
      branchId: new mongoose.Types.ObjectId(branchId)
    };

    if (vendorSearch) {
      matchQuery.vendor = { $regex: vendorSearch, $options: "i" };
    }

    if (fromDate || toDate) {
      let startStr = fromDate;
      let endStr = toDate;

      if (startStr && endStr && startStr > endStr) {
        [startStr, endStr] = [endStr, startStr];
      }

      matchQuery.createdAt = {};
      if (startStr) matchQuery.createdAt.$gte = new Date(startStr);
      if (endStr) {
        const end = new Date(endStr);
        end.setHours(23, 59, 59, 999);
        matchQuery.createdAt.$lte = end;
      }
    }

    const aggregation = [
      { $match: matchQuery },
      { $unwind: "$items" }
    ];

    if (productId) {
      aggregation.push({
        $match: { "items.productId": new mongoose.Types.ObjectId(productId) }
      });
    }

    // Optional: match by productGroupId if passed (need a lookup on Product to check group)
    if (productGroupId) {
      aggregation.push(
        {
          $lookup: {
            from: "products",
            localField: "items.productId",
            foreignField: "_id",
            as: "productInfo"
          }
        },
        { $unwind: "$productInfo" },
        {
          $match: { "productInfo.productGroup": new mongoose.Types.ObjectId(productGroupId) }
        }
      );
    }

    // Sorting setup
    let sortStage = { "createdAt": sortDirection === 'desc' ? -1 : 1 };
    
    if (sortKey === 'qty') sortStage = { "items.qty": sortDirection === 'desc' ? -1 : 1 };
    if (sortKey === 'purchase') sortStage = { "items.purchasePrice": sortDirection === 'desc' ? -1 : 1 };
    if (sortKey === 'vendor') sortStage = { "vendor": sortDirection === 'desc' ? -1 : 1 };
    if (sortKey === 'product') sortStage = { "items.name": sortDirection === 'desc' ? -1 : 1 };

    aggregation.push({ $sort: sortStage });

    // Pagination
    const facetStage = {
      $facet: {
        metadata: [{ $count: "total" }],
        data: [{ $skip: skip }, { $limit: limitNum }]
      }
    };
    aggregation.push(facetStage);

    const result = await PurchaseInvoice.aggregate(aggregation).allowDiskUse(true);

    const data = result[0].data || [];
    const totalCount = result[0].metadata[0]?.total || 0;

    let totalQty = 0;
    
    // Format response
    const history = data.map(doc => {
      totalQty += (doc.items.qty || 0);

      return {
        _id: doc._id,
        invoiceId: doc._id,
        invoiceNumber: doc.purchaseInvoiceId,
        date: doc.createdAt,
        createdAt: doc.createdAt,
        voucherType: "PURCHASE",
        vendorName: doc.vendor,
        productId: doc.items.productId,
        productName: doc.items.name,
        productGroupName: doc.items.productGroup || "No Group",
        purchasingPrice: doc.items.purchasePrice,
        mrp: doc.items.mrp,
        qty: doc.items.qty,
        batch: doc.items.batch,
        unit: doc.items.unit
      };
    });

    res.json({
      history,
      total: totalCount,
      totalQty
    });

  } catch (error) {
    console.error("Purchase History Error:", error);
    res.status(500).json({ message: "Failed to fetch purchase history" });
  }
});

// GET SINGLE PURCHASE INVOICE
router.get("/:id", async (req, res) => {
  try {
    const invoice = await PurchaseInvoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
