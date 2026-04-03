import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";

/**
 * GSTZen E-Invoice & E-Way Bill Service (FINAL ROBUST VERSION)
 */

class GSTZenService {
  constructor() {
    this.apiKey = (process.env.GSTZen_API_KEY || "").trim();
    // Normalize Base URL to NOT have a trailing slash
    this.baseUrl = (process.env.GSTZEN_BASE_URL || "https://my.gstzen.in").trim().replace(/\/+$/, "");
    
    this.cookieJar = new CookieJar();
    
    this.apiClient = wrapper(axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      jar: this.cookieJar,
      withCredentials: true,
      headers: {
        "Content-Type": "application/json"
      }
    }));

    this.apiClient.interceptors.request.use((config) => {
      config.headers["Token"] = this.apiKey;
      return config;
    });
  }

  /**
   * Generates E-Invoice (IRN) and optionally E-Way Bill
   */
  async generateEInvoice(invoiceData) {
    try {
      console.log("\n🚀 Generating E-Invoice IRN...");
      
      // 🛡️ HSN PRE-CHECK: GSTZen/NIC/Tax Portal requires a minimum of 6 digits for B2B E-Invoices.
      // (NIC strictly rejects 4-digit HSNs for businesses above the ₹5Cr threshold).
      if (invoiceData.items && Array.isArray(invoiceData.items)) {
        for (const item of invoiceData.items) {
          const hsn = String(item.hsn || item.productId?.hsnCode || "").trim();
          // NIC portal currently enforces 6 or 8 digits for E-Invoicing
          if (!/^\d{6}$|^\d{8}$/.test(hsn)) {
            const errorMsg = `Product "${item.name}" has a 4-digit HSN code "${hsn}". ` +
                           `The Tax Portal requires a minimum of 6 digits for E-Invoicing. ` +
                           `Please update the HSN to 6 digits (e.g., 160100) in the product master or edit the bill to proceed.`;
            console.error(`❌ Pre-check fail: ${errorMsg}`);
            throw new Error(errorMsg);
          }
        }
      }

      // 🛡️ INVOICE NUMBER LENGTH PRE-CHECK
      if (String(invoiceData.invoiceNumber).length > 16) {
        throw new Error(`Invoice Number "${invoiceData.invoiceNumber}" is too long (${invoiceData.invoiceNumber.length} chars). Max 16 allowed for E-Invoicing.`);
      }

      const sellerGstin = invoiceData.seller?.gstin || invoiceData.branchId?.gstin || "33DULPS2600Q1Z6";
      const sellerStateCode = String(invoiceData.seller?.stateCode || invoiceData.branchId?.stateCode || "33").padStart(2, "0");
      const buyerGstin = invoiceData.customer?.gstin || invoiceData.customer?.customerId?.gstin || "URP";
      const buyerStateCode = String(invoiceData.customer?.stateCode || invoiceData.customer?.customerId?.stateCode || "33").padStart(2, "0");
      const isInterState = sellerStateCode !== buyerStateCode;

      const itemList = invoiceData.items.map((item, idx) => {
        const qty = Number(item.qty || 0);
        const rate = Number(item.sellingPrice || 0);
        const discount = Number(item.discountAmount || 0);
        const gstRt = Number(item.gst || 0);
        const assessableAmt = Number((qty * rate - discount).toFixed(2));
        const taxAmt = Number((assessableAmt * gstRt / 100).toFixed(2));
        let cgstAmt = 0, sgstAmt = 0, igstAmt = 0;
        if (isInterState) { igstAmt = taxAmt; } else { cgstAmt = sgstAmt = Number((taxAmt / 2).toFixed(2)); }

        return {
          SlNo: String(idx + 1),
          PrdDesc: String(item.name || "Product").substring(0, 100),
          HsnCd: String(item.hsn || item.productId?.hsnCode || "21050000").trim(),
          Qty: qty, Units: "NOS", UnitPrice: rate, TotAmt: Number((qty * rate).toFixed(2)),
          Discount: discount, AssAmt: assessableAmt, GstRt: gstRt,
          IgstAmt: igstAmt, CgstAmt: cgstAmt, SgstAmt: sgstAmt,
          TotItemVal: Number((assessableAmt + taxAmt).toFixed(2))
        };
      });

      const payload = {
        Version: "1.1",
        TranDtls: { TaxSch: "GST", SupTyp: "B2B", RegRev: "N", IgstOnIntra: "N" },
        DocDtls: { Typ: "INV", No: String(invoiceData.invoiceNumber), Dt: this.formatDate(invoiceData.invoiceDate) },
        SellerDtls: {
          Gstin: sellerGstin, LglNm: String(invoiceData.seller?.name || invoiceData.branchId?.name || "Seller"),
          Addr1: String(invoiceData.seller?.address || invoiceData.branchId?.address || "Address"),
          Loc: String(invoiceData.seller?.city || invoiceData.branchId?.city || "CITY"),
          Pin: Number(invoiceData.seller?.pincode || invoiceData.branchId?.pincode || 627003),
          Stcd: sellerStateCode
        },
        BuyerDtls: {
          Gstin: buyerGstin, LglNm: String(invoiceData.customer?.name || "Buyer"), Pos: buyerStateCode,
          Addr1: String(invoiceData.customer?.address || "Address"),
          Loc: String(invoiceData.customer?.city || "CITY"),
          Pin: Number(invoiceData.customer?.pincode || invoiceData.customer?.customerId?.pincode || 628501),
          Stcd: buyerStateCode
        },
        ItemList: itemList,
        ValDtls: {
          AssVal: Number((invoiceData.subtotal || 0).toFixed(2)),
          CgstVal: Number((invoiceData.totalTax?.cgst || 0).toFixed(2)),
          SgstVal: Number((invoiceData.totalTax?.sgst || 0).toFixed(2)),
          IgstVal: Number((invoiceData.totalTax?.igst || 0).toFixed(2)),
          TotInvVal: Number((invoiceData.grandTotal || 0).toFixed(2))
        }
      };

      if (invoiceData.vehicleNo) {
        payload.EwbDtls = {
          TransMode: invoiceData.transportMode || "1",
          Distance: Number(invoiceData.transportDistance || 50),
          VehNo: String(invoiceData.vehicleNo).replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
          VehType: invoiceData.vehicleType === "OVERSIZED" ? "O" : "R"
        };
      }

      // Final Path Logic
      let endpoint = (process.env.GSTZEN_EINVOICE_ENDPOINT || "").trim().replace(/^\/+/, "");
      if (!endpoint) throw new Error("GSTZEN_EINVOICE_ENDPOINT missing in .env");

      console.log(`📡 Sending to: ${this.baseUrl}/${endpoint}`);
      const response = await this.apiClient.post(endpoint, payload);
      const result = response.data;
      console.log("📝 GSTZen Success IRN:", result.Irn || result.irn || "Already Gen");

      if (result.status === 1 || result.Irn || result.irn) {
        return {
          success: true,
          irn: result.Irn || result.irn,
          ackNo: result.AckNo || result.ackNo,
          ackDate: result.AckDt || result.ackDate,
          ewayBillNo: result.EwbNo || result.ewbNo,
          invoicePdfUrl: result.InvoicePdfUrl,
          ewayBillPdfUrl: result.EWayBillPdfUrl,
          qrCodeUrl: result.QrCodeImageUrl || result.QrCodeUrl || result.IrnQrCodeUrl,
          signedInvoice: result.SignedInvoice,
          signedQrCode: result.SignedQRCode || result.SignedQrCode
        };
      } else {
        throw new Error(result.message || "Tax Portal Validation Error");
      }
    } catch (error) {
      console.error("❌ E-Invoice Fail:", error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Identical robust logic for standalone e-way bill update
   */
  async generateEWayBill(invoiceData, irnData) {
    try {
      const now = new Date().toLocaleTimeString();
      console.log(`\n🚚 [${now}] FORCING Standalone E-Way Bill Update...`);
      
      const cleanVehNo = String(invoiceData.vehicleNo).replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      const distance = Number(invoiceData.transportDistance || 59);

      const payload = {
        Version: "1.1",
        Irn: irnData.irn || invoiceData.irn,
        // Including TranDtls and DocDtls forces GSTZen to treat this as a fresh validation attempt
        TranDtls: { TaxSch: "GST", SupTyp: "B2B", RegRev: "N", IgstOnIntra: "N" },
        DocDtls: { 
          Typ: "INV", 
          No: String(invoiceData.invoiceNumber), 
          Dt: this.formatDate(invoiceData.invoiceDate) 
        },
        SellerDtls: { Gstin: invoiceData.seller?.gstin || invoiceData.branchId?.gstin || "33DULPS2600Q1Z6" },
        EwbDtls: {
          TransMode: invoiceData.transportMode || "1",
          Distance: distance,
          TransGstin: invoiceData.transporterId || "",
          TransName: invoiceData.transporterName || "",
          VehNo: cleanVehNo,
          VehType: invoiceData.vehicleType === "OVERSIZED" ? "O" : "R"
        }
      };

      // 🚀 RESTORE THE WORKING ENDPOINT
      let endpoint = process.env.GSTZEN_EINVOICE_ENDPOINT || "/~gstzen/a/post-einvoice-data/einvoice-json/";
      endpoint = endpoint.trim().replace(/^\/+/, "");

      const fullUrl = `${this.baseUrl}/${endpoint}`;
      console.log(`📡 Sending [Transport Update] to: ${fullUrl}`);
      console.log(`📦 EWB REQUEST: Veh=[${cleanVehNo}], Distance=[${distance}]`);

      const response = await this.apiClient.post(endpoint, payload);
      const result = response.data;
      console.log("📝 GSTZen [Transport Update] Response:", JSON.stringify(result, null, 2));

      // 🔴 STICKER SUCCESS CHECK: Only success if we actually got an EWB number
      const ewbNo = result.EwbNo || result.ewbNo;

      if (ewbNo) {
        console.log(`✅ Success! EWB No: ${ewbNo}`);
        return {
          success: true,
          ewayBillNo: ewbNo,
          ewayBillDate: result.EwbDt || result.ewbDate,
          ewayBillValidUntil: result.EwbValidTill || result.ewbValidUntil,
          ewayBillPdfUrl: result.EWayBillPdfUrl
        };
      } else {
        // Find specific errors in InfoDtls if possible
        let errorMsg = result.message || "E-Way Bill Generation Failed";
        if (result.InfoDtls && result.InfoDtls.length > 0) {
          const firstErr = result.InfoDtls[0].Desc?.[0]?.ErrorMessage;
          if (firstErr) errorMsg = `${errorMsg}: ${firstErr}`;
        }
        return { success: false, message: errorMsg, raw: result };
      }
    } catch (error) {
      console.error("❌ EWB Failure:", error.response?.data || error.message);
      return { success: false, message: error.message };
    }
  }

  formatDate(date) {
    if (!date) date = new Date();
    if (typeof date === "string") date = new Date(date);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}/${date.getFullYear()}`;
  }
}

export default new GSTZenService();
