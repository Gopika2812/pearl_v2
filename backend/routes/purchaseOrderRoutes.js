import express from "express";
import Product from "../models/Product.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import Vendor from "../models/Vendor.js";
import VoucherType from "../models/VoucherType.js";
import GLService from "../utils/glService.js";

const router = express.Router();

// Financial Year Helper
const getFinancialYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
};

// GET NEXT INVOICE ID (without saving)
router.get("/next-invoice/:voucherType", async (req, res) => {
  try {
    const { voucherType } = req.params;
    const { branchId } = req.query;

    if (!branchId) {
      return res.status(400).json({ message: "branchId is required" });
    }

    const voucher = await VoucherType.findOne({
      branchId,
      name: voucherType.toLowerCase(),
      orderType: "PO",
    });

    if (!voucher) return res.status(404).json({ message: "Voucher not found" });

    const currentFY = getFinancialYear();

    let counter = voucher.counter || 1;
    if (voucher.financialYear !== currentFY) {
      counter = 1;
    }

    const nextInvoiceId = `${voucher.prefix}/${String(counter).padStart(
      3,
      "0"
    )}/${currentFY}`;

    res.json({ nextInvoiceId });
  } catch (err) {
    console.error("Next invoice error:", err);
    res.status(500).json({ message: err.message });
  }
});

// GET ALL PURCHASE ORDERS
router.get("/", async (req, res) => {
  try {
    const { branchId } = req.query;
    const query = {};
    
    // Filter by branchId if provided
    if (branchId) {
      query.branchId = branchId;
    }
    
    console.log("🔍 GET /api/purchase-orders - Fetching POs with query:", query);
    const orders = await PurchaseOrder.find(query).sort({ createdAt: -1 });
    console.log(`✅ Found ${orders.length} purchase orders`);
    
    res.json(orders);
  } catch (err) {
    console.error("❌ Get POs error:", err);
    res.status(500).json({ 
      message: err.message 
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const { voucherType, branchId, status, ...rest } = req.body;

    if (!rest.items || rest.items.length === 0) {
      return res.status(400).json({ message: "At least one item is required" });
    }

    if (!branchId) {
      return res.status(400).json({ message: "branchId is required" });
    }

    // Round numeric fields if provided
    if (rest.grandTotal !== undefined) {
      rest.grandTotal = Math.round(Number(rest.grandTotal));
    }
    if (rest.subtotal !== undefined) {
      rest.subtotal = Math.round(Number(rest.subtotal));
    }
    if (rest.totalTax !== undefined) {
      rest.totalTax = Math.round(Number(rest.totalTax));
    }
    if (rest.totalDiscount !== undefined) {
      rest.totalDiscount = Math.round(Number(rest.totalDiscount));
    }
    if (rest.transportCharge !== undefined) {
      rest.transportCharge = Math.round(Number(rest.transportCharge));
    }

    const voucher = await VoucherType.findOne({ branchId, name: voucherType });
    if (!voucher) {
      return res.status(404).json({ message: "Voucher not found" });
    }

    const currentFY = getFinancialYear();

    if (voucher.financialYear !== currentFY) {
      voucher.counter = 1;
      voucher.financialYear = currentFY;
    }

    // ✅ ONLY prefix here
    const invoiceId = `${voucher.prefix}/${String(voucher.counter).padStart(
      3,
      "0"
    )}/${currentFY}`;

    const order = new PurchaseOrder({
      invoiceId,
      voucherType,
      branchId,
      financialYear: currentFY,
      ...rest,
      status: status || "PLACED",
    });

    await order.save();

    // ✅ UPDATE PRODUCT INVENTORY
    if (status !== "DRAFT") {
      for (const item of rest.items) {
        try {
          const product = await Product.findByIdAndUpdate(
            item.productId,
            { $inc: { totalQty: item.qty } },
            { new: true }
          );
          if (product) {
            console.log(
              `✅ Product "${product.name}" inventory updated: +${item.qty} units (New total: ${product.totalQty})`
            );
          }
        } catch (err) {
          console.error(`⚠️ Failed to update product ${item.productId}:`, err.message);
        }
      }

      // ✅ UPDATE VENDOR AP (ACCOUNTS PAYABLE) BALANCE
      if (rest.vendor && rest.vendor.id) {
        try {
          const vendor = await Vendor.findById(rest.vendor.id);
          if (vendor) {
            const grandTotal = rest.grandTotal || 0;
            const newClosingBalance = (vendor.closingBalance || 0) + grandTotal;
            await Vendor.findByIdAndUpdate(
              rest.vendor.id,
              { closingBalance: newClosingBalance },
              { new: true }
            );
            console.log(`✅ Vendor AP balance updated: +₹${grandTotal}, New balance: ₹${newClosingBalance}`);
          }
        } catch (err) {
          console.warn(`⚠️ Failed to update vendor balance:`, err.message);
        }
      }

      // ✅ POST JOURNAL ENTRY to GL
      try {
        const journalEntry = await GLService.postPurchaseOrderJE(order);
        console.log(`✅ GL Entry posted: ${journalEntry.jeId}`);
      } catch (glError) {
        console.warn("⚠️ GL posting failed (non-blocking):", glError.message);
        // Don't fail the PO creation if GL posting fails
      }

      voucher.counter += 1;
      await voucher.save();
    }

    res.status(201).json({
      message: "Purchase Order saved successfully",
      order,
    });
  } catch (err) {
    console.error("PO save error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.get("/items", async (req, res) => {
  try {
    const orders = await PurchaseOrder.find({ status: "PLACED" });

    const stockMap = {};

    orders.forEach((order) => {
      order.items.forEach((item) => {
        const key = `${order.warehouse}_${item.productId}`;

        if (!stockMap[key]) {
          stockMap[key] = {
            productId: item.productId,
            warehouse: order.warehouse,
            qty: 0,
            sellingPrice: item.sellingPrice,
            gst: item.gst,
            hsn: item.hsn,
          };
        }

        stockMap[key].qty += item.qty;
      });
    });

    res.json(Object.values(stockMap));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load stock" });
  }
});

// DELETE PURCHASE ORDER
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const purchaseOrder = await PurchaseOrder.findByIdAndDelete(id);

    if (!purchaseOrder) {
      return res.status(404).json({ message: "Purchase Order not found" });
    }

    // Reverse inventory updates if PO was PLACED
    if (purchaseOrder.status === "PLACED") {
      for (const item of purchaseOrder.items) {
        try {
          const product = await Product.findByIdAndUpdate(
            item.productId,
            { $inc: { totalQty: -item.qty } },
            { new: true }
          );
          if (product) {
            console.log(
              `✅ Product "${product.name}" inventory reversed: -${item.qty} units`
            );
          }
        } catch (err) {
          console.error(`⚠️ Failed to reverse product ${item.productId}:`, err.message);
        }
      }

      // Reverse vendor AP balance update
      if (purchaseOrder.vendor) {
        try {
          const vendorId = purchaseOrder.vendor.id || purchaseOrder.vendor;
          const grandTotal = purchaseOrder.grandTotal || 0;
          await Vendor.findByIdAndUpdate(
            vendorId,
            { $inc: { closingBalance: -grandTotal } },
            { new: true }
          );
          console.log(
            `✅ Vendor AP balance reversed: -₹${grandTotal}`
          );
        } catch (err) {
          console.warn(`⚠️ Failed to reverse vendor balance:`, err.message);
        }
      }
    }

    res.json({
      success: true,
      message: "Purchase Order deleted successfully",
    });
  } catch (err) {
    console.error("Delete PO error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

export default router;
