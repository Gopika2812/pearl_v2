import PurchaseOrder from "../../../models/PurchaseOrder.js";
import Product from "../../../models/Product.js";
import Vendor from "../../../models/Vendor.js";
import VoucherType from "../../../models/VoucherType.js";
import { getFinancialYear } from "../../../utils/financialYear.js";
import { createAuditLog } from "../../../utils/logUtil.js";
import { updateProductCostsFromInvoice } from "../../../utils/priceUtil.js";
import mongoose from "mongoose";

class POCreationService {
  /**
   * Confirms a recommendation and creates an actual PO in the system.
   * Leverages the existing PO workflows and vouchers.
   */
  async createPurchaseOrderFromSuggestions(branchId, vendorId, items, requestedByUser) {
    if (!branchId || !vendorId || !items || items.length === 0) {
      throw new Error("Missing required fields for Purchase Order creation");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Fetch vendor
      const vendorRecord = await Vendor.findOne({ _id: vendorId, branchId });
      if (!vendorRecord) {
        throw new Error("Vendor not found for the given branch");
      }

      // 2. Fetch and formulate PO items
      const poItems = [];
      let subtotal = 0;
      let totalTax = 0;

      for (const item of items) {
        const product = await Product.findOne({ _id: item.productId, branchId });
        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        const qty = Number(item.qty);
        const purchasePrice = Number(item.purchasePrice || product.purchasingPrice || 0);
        const gst = Number(product.gst || 0);
        
        const rowPrice = qty * purchasePrice;
        const rowTax = (rowPrice * gst) / 100;
        const total = rowPrice + rowTax;

        poItems.push({
          productId: product._id,
          name: product.name,
          productGroup: product.productGroup ? String(product.productGroup) : "",
          qty,
          purchasePrice,
          sellingPrice: product.sellingPrice || 0,
          rowPrice,
          discountPercent: 0,
          discountAmount: 0,
          taxableAmount: rowPrice,
          rowTax,
          hsn: product.hsnCode || product.hsn,
          gst,
          cgst: gst / 2,
          sgst: gst / 2,
          igst: false,
          unit: product.units || "",
          total,
        });

        subtotal += rowPrice;
        totalTax += rowTax;
      }

      // 3. Resolve PO Voucher Type Sequence
      const currentFY = getFinancialYear();
      
      let voucher = await VoucherType.findOne({ branchId, name: "purchase order", orderType: "PO" }).session(session);
      if (!voucher) {
        voucher = await VoucherType.findOne({ branchId, orderType: "PO" }).session(session);
      }

      if (!voucher) {
        // Self-heal: create default PO voucher type
        voucher = new VoucherType({
          branchId,
          name: "purchase order",
          orderType: "PO",
          prefix: "PO",
          counter: 1,
          financialYear: currentFY,
        });
        await voucher.save({ session });
      }

      if (voucher.financialYear !== currentFY) {
        voucher.counter = 1;
        voucher.financialYear = currentFY;
      }

      // Safeguard: Check highest PO in database to avoid counter overlaps
      const regex = new RegExp(`^${voucher.prefix}/\\d+/${currentFY}$`);
      const highestPO = await PurchaseOrder.findOne({ invoiceId: regex }).sort({ invoiceId: -1 }).lean().session(session);
      if (highestPO) {
        const parts = highestPO.invoiceId.split('/');
        const highestNum = parseInt(parts[1], 10);
        if (!isNaN(highestNum) && voucher.counter <= highestNum) {
          voucher.counter = highestNum + 1;
        }
      }

      const invoiceId = `${voucher.prefix}/${String(voucher.counter).padStart(3, "0")}/${currentFY}`;

      // 4. Create and Save Purchase Order
      const grandTotal = Math.round(subtotal + totalTax);

      const purchaseOrder = new PurchaseOrder({
        branchId,
        invoiceId,
        voucherType: voucher.name,
        financialYear: currentFY,
        vendor: vendorRecord.name,
        vendorId: vendorRecord._id,
        items: poItems,
        subtotal: Math.round(subtotal),
        totalTax: Math.round(totalTax),
        grandTotal,
        billingPerson: requestedByUser?.username || "Super Admin",
        agent: requestedByUser?.fullName || "AI Procurement Assistant",
        status: "PLACED",
        date: new Date(),
      });

      await purchaseOrder.save({ session });

      // Increment voucher counter
      voucher.counter += 1;
      await voucher.save({ session });

      // Commit transaction
      await session.commitTransaction();
      session.endSession();

      // 5. Post-creation operations (Non-blocking / outside transaction)
      // Instant price sync
      try {
        await updateProductCostsFromInvoice(poItems, invoiceId, false, requestedByUser);
      } catch (err) {
        console.warn("⚠️ Price Sync Failed (Non-blocking) during AI PO creation:", err.message);
      }

      // Create Audit Log
      await createAuditLog({
        userId: requestedByUser?.id || requestedByUser?._id,
        userModel: "SuperAdmin",
        username: requestedByUser?.username || "superadmin",
        branchId,
        action: "CREATE_PO",
        description: `Created Purchase Order: ${invoiceId} via AI Procurement Assistant (Vendor: ${vendorRecord.name}). Total: ₹${grandTotal}`,
        targetId: purchaseOrder._id,
        targetModel: "PurchaseOrder",
      });

      return purchaseOrder;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error("Error creating PO from AI suggestions:", error);
      throw error;
    }
  }
}

export default new POCreationService();
