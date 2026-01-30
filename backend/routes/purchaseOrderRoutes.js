import express from "express";
import PurchaseOrder from "../models/PurchaseOrder.js";
import VoucherType from "../models/VoucherType.js";

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

    const voucher = await VoucherType.findOne({
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

router.post("/", async (req, res) => {
  try {
    const { voucherType, status, ...rest } = req.body;

    if (!rest.items || rest.items.length === 0) {
      return res.status(400).json({ message: "At least one item is required" });
    }

    const voucher = await VoucherType.findOne({ name: voucherType });
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
      financialYear: currentFY,
      ...rest,
      status: status || "PLACED",
    });

    await order.save();

    if (status !== "DRAFT") {
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
    const orders = await PurchaseOrder.find(
      { status: "PLACED" },
      { items: 1 }
    ).sort({ createdAt: -1 });

    // flatten items
    const itemMap = new Map();

    orders.forEach(order => {
      order.items.forEach(item => {
        // keep latest PO item per product
        if (!itemMap.has(item.productId.toString())) {
          itemMap.set(item.productId.toString(), {
            productId: item.productId.toString(),
            name: item.name,
            hsn: item.hsn,
            gst: item.gst,
            sellingPrice: item.sellingPrice,
          });
        }
      });
    });

    res.json([...itemMap.values()]);
  } catch (err) {
    console.error("PO ITEMS ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});



export default router;
