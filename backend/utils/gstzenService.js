import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";

/**
 * GSTZen E-Invoice & E-Way Bill Service
 * API Documentation: https://api.gstzen.in/docs
 */

class GSTZenService {
  constructor() {
    // Load and trim API key and base URL
    this.apiKey = (process.env.GSTZEN_API_KEY || "").trim();
    this.baseUrl = (process.env.GSTZEN_BASE_URL || "https://my.gstzen.in").trim();
    
    if (!this.apiKey) {
      console.error("❌ CRITICAL: GSTZEN_API_KEY is not set in environment variables!");
    }
    
    if (!this.apiKey.includes('-')) {
      console.error("⚠️  API Key format looks suspicious (no dashes). Expected format: xxxx-xxxx-xxxx-xxxx");
    }
    
    // Create a CookieJar to persists cookies across requests
    this.cookieJar = new CookieJar();
    
    // Create axios instance with proper headers and cookie jar support
    this.apiClient = wrapper(axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      jar: this.cookieJar,
      withCredentials: true,
      // Add headers explicitly for each request
      headers: {
        "Content-Type": "application/json"
      },
      validateStatus: () => true // Don't throw on any status code
    }));

    // Add interceptor to include Token header on all requests
    this.apiClient.interceptors.request.use((config) => {
      config.headers["Token"] = this.apiKey;
      return config;
    });
  }

  /**
   * GENERATE E-INVOICE
   * Generate IRN (Invoice Reference Number) for an invoice
   */
  async generateEInvoice(invoiceData) {
    try {
      console.log("📄 Generating E-Invoice via GSTZen...");
      console.log("🔗 API Base URL:", this.baseUrl);
      console.log("🔑 API Key:", this.apiKey ? this.apiKey.substring(0, 8) + "..." : "NOT SET");

      // Validate required seller data
      const sellerGstin = invoiceData.seller?.gstin || invoiceData.branchId?.gstin;
      if (!sellerGstin) {
        throw new Error("Seller GSTIN is required. Update your branch profile.");
      }

      const sellerStateCode = invoiceData.seller?.stateCode || invoiceData.branchId?.stateCode;
      if (!sellerStateCode) {
        throw new Error("Seller State Code is required. Update your branch profile with a valid state code (33, 32, 29, 27, etc.)");
      }

      const buyerGstin = invoiceData.customer?.gstin || invoiceData.customer?.customerId?.gstin || "URP";
      const buyerStateCode = invoiceData.customer?.stateCode || invoiceData.customer?.customerId?.stateCode || "33";
      
      console.log("✓ Seller GSTIN:", sellerGstin);
      console.log("✓ Seller State Code:", sellerStateCode);
      console.log("✓ Buyer GSTIN:", buyerGstin);
      console.log("✓ Buyer State Code:", buyerStateCode);

      // Map invoice data to GSTZen schema (v1.03)
      const payload = {
        DocDtls: {
          Typ: "INV",
          No: String(invoiceData.invoiceNumber),
          Dt: this.formatDate(invoiceData.invoiceDate)
        },
        SellerDtls: {
          Gstin: invoiceData.seller?.gstin || invoiceData.branchId?.gstin,
          LglNm: invoiceData.seller?.name || invoiceData.branchId?.name,
          Addr1: invoiceData.seller?.address || invoiceData.branchId?.address,
          Loc: invoiceData.seller?.city || invoiceData.branchId?.city || "CITY",
          Pin: Number(invoiceData.seller?.pincode || invoiceData.branchId?.pincode || 0),
          Stcd: String(invoiceData.seller?.stateCode || invoiceData.branchId?.stateCode || "33")
        },
        BuyerDtls: {
          Gstin: invoiceData.customer?.gstin || invoiceData.customer?.customerId?.gstin || "URP",
          LglNm: invoiceData.customer?.name || invoiceData.customer?.customerId?.name || "Buyer",
          Addr1: invoiceData.customer?.address || invoiceData.customer?.customerId?.address || "Address",
          Loc: invoiceData.customer?.city || invoiceData.customer?.customerId?.city || "CITY",
          Pin: Number(invoiceData.customer?.pincode || invoiceData.customer?.customerId?.pincode || 0),
          Stcd: String(buyerStateCode)
        },
        DispDtls: {
          Nm: invoiceData.dispatchLocation || invoiceData.branchId?.name,
          Addr1: invoiceData.branchId?.address,
          Loc: invoiceData.branchId?.city,
          Pin: Number(invoiceData.branchId?.pincode || 0),
          Stcd: String(sellerStateCode)
        },
        ShipDtls: {
          Gstin: invoiceData.customer?.gstin || invoiceData.customer?.customerId?.gstin || "URP",
          Nm: invoiceData.customer?.name || invoiceData.customer?.customerId?.name || "Buyer",
          Addr1: invoiceData.customer?.address || invoiceData.customer?.customerId?.address || "Address",
          Loc: invoiceData.customer?.city || invoiceData.customer?.customerId?.city || "CITY",
          Pin: Number(invoiceData.customer?.pincode || invoiceData.customer?.customerId?.pincode || 0),
          Stcd: String(buyerStateCode)
        },
        ItemList: invoiceData.items.map((item, idx) => {
          // Map actual invoice item fields to GSTZen schema
          const qty = Number(item.qty || item.quantity || 0);
          const rate = Number(item.sellingPrice || item.rate || 0);
          const discount = Number(item.discountAmount || item.discount || 0);
          const gstRate = Number(item.gst || item.gstRate || 0);
          const hsn = item.hsn || item.productId?.hsnCode || "1000";
          const unit = item.unit || "NOS";
          const totAmt = Number((qty * rate).toFixed(2));
          const preTaxVal = Number((totAmt - discount).toFixed(2));
          const taxAmt = Number((preTaxVal * gstRate / 100).toFixed(2));
          const netAmt = Number((preTaxVal * (1 + gstRate / 100)).toFixed(2));
          return {
            SlNo: String(idx + 1),
            IsServc: "N",
            HsnCd: hsn,
            Qty: qty,
            Unit: unit,
            UnitPrice: rate,
            TotAmt: totAmt,
            Discount: discount,
            PreTaxVal: preTaxVal,
            TaxRt: gstRate,
            TaxAmt: taxAmt,
            NetAmt: netAmt
          };
        }),
        ValDtls: (() => {
          // Calculate value details from items
          const isSameState = sellerStateCode === buyerStateCode;
          let totalAssVal = 0;
          let totalTaxAmt = 0;
          let totalDiscount = 0;

          // Sum up from items
          invoiceData.items.forEach(item => {
            const qty = Number(item.qty || item.quantity || 0);
            const rate = Number(item.sellingPrice || item.rate || 0);
            const discount = Number(item.discountAmount || item.discount || 0);
            const gstRate = Number(item.gst || item.gstRate || 0);
            
            const totAmt = Number((qty * rate).toFixed(2));
            const preTaxVal = Number((totAmt - discount).toFixed(2));
            const taxAmt = Number((preTaxVal * gstRate / 100).toFixed(2));
            
            totalAssVal += preTaxVal;
            totalTaxAmt += taxAmt;
            totalDiscount += discount;
          });

          totalAssVal = Number(totalAssVal.toFixed(2));
          totalTaxAmt = Number(totalTaxAmt.toFixed(2));
          totalDiscount = Number(totalDiscount.toFixed(2));

          let cgstVal = 0, sgstVal = 0, igstVal = 0;
          
          if (isSameState) {
            // Intra-state: split tax 50-50 between CGST and SGST
            cgstVal = Number((totalTaxAmt / 2).toFixed(2));
            sgstVal = Number((totalTaxAmt / 2).toFixed(2));
          } else {
            // Inter-state: use IGST
            igstVal = totalTaxAmt;
          }

          const totInvVal = Number((totalAssVal + totalTaxAmt).toFixed(2));

          return {
            AssVal: totalAssVal,
            CgstVal: cgstVal,
            SgstVal: sgstVal,
            IgstVal: igstVal,
            CesVal: Number(invoiceData.cess || 0),
            TotInvVal: totInvVal,
            Discount: totalDiscount,
            OthChrg: Number(invoiceData.otherCharges || 0),
            RndOffAmt: Number(invoiceData.roundOff || 0),
            TotPayableAmt: totInvVal
          };
        })(),
        PayDtls: {
          Nm: invoiceData.paymentMode || "CREDIT",
          FindNm: invoiceData.bankName || "",
          AccDet: invoiceData.bankAccountNo || "",
          IFSC: invoiceData.bankIfsc || "",
          CrTrn: invoiceData.chequeNo || ""
        },
        RefDtls: {
          InvRm: invoiceData.remarks || "",
          DocPerd: invoiceData.documentPeriod || "01",
          PrecDocDtls: []
        }
      };

      const endpoint = "/api/v1/invoice";
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🔗 Calling GSTZen API: ${this.baseUrl}${endpoint}`);
      console.log(`🔑 API Key Status: ${this.apiKey ? '✓ SET' : '❌ NOT SET'}`);
      console.log(`🔑 API Key Info: ${this.apiKey ? this.apiKey.substring(0, 12) + "..." + this.apiKey.substring(this.apiKey.length - 4) : "NOT SET"}`);
      console.log(`🍪 Cookie Jar: ${this.cookieJar ? 'Enabled' : 'Disabled'}`);
      console.log(`📤 Full Payload:`);
      console.log(JSON.stringify(payload, null, 2));
      console.log(`${'='.repeat(80)}\n`);
      
      // Log request config before sending
      console.log(`📋 Request Config:`);
      console.log(`   Method: POST`);
      console.log(`   URL: ${this.baseUrl}${endpoint}`);
      console.log(`   Headers:`, JSON.stringify(
        { 'Content-Type': 'application/json', 'Token': 'TOKEN_REDACTED' },
        null,
        2
      ));
      
      const response = await this.apiClient.post(endpoint, payload);

      console.log(`\n${'='.repeat(80)}`);
      console.log(`✅ API Response Status: ${response.status}`);
      console.log(`📬 Response Headers:`, JSON.stringify(response.headers, null, 2));
      
      // Log first part of response data
      if (typeof response.data === 'string') {
        if (response.data.includes('<!doctype html') || response.data.includes('<html')) {
          console.log(`⚠️  Response is HTML (Error Page):`);
          console.log(`   ${response.data.substring(0, 300)}...`);
        } else {
          console.log(`📋 Response Data:`, response.data.substring(0, 500));
        }
      } else {
        console.log(`📋 Response Data:`, JSON.stringify(response.data, null, 2));
      }
      console.log(`${'='.repeat(80)}\n`);
      
      // Check if response is HTML (error page)
      if (typeof response.data === 'string' && response.data.includes('<!doctype html')) {
        throw new Error(`GSTZen returned HTML page instead of JSON. Possible authentication issue. Check GSTZEN_API_KEY format.`);
      }
      
      const result = response.data.data || response.data;
      
      // Check if response contains success indicator
      if (response.data.success || response.status === 200 || response.data.status === "Success" || result.irn || result.Irn) {
        return {
          success: true,
          irn: result.irn || result.Irn,
          ackNo: result.ackNo || result.AckNo,
          ackDate: result.ackDt || result.AckDt,
          signedInvoice: result.signedInvoice || result.SignedInvoice,
          signedQrCode: result.signedQrCode || result.SignedQrCode,
          responseData: result
        };
      } else {
        throw new Error(response.data.message || JSON.stringify(response.data));
      }
    } catch (error) {
      const errorStatus = error.response?.status;
      let errorMsg = error.message;
      
      if (error.response?.data) {
        if (typeof error.response.data === 'string') {
          // Could be HTML
          if (error.response.data.includes('<!doctype html') || error.response.data.includes('<html')) {
            errorMsg = `GSTZen returned HTML (likely an error page). Status: ${errorStatus}`;
          } else {
            errorMsg = error.response.data.substring(0, 200);
          }
        } else {
          errorMsg = error.response.data.message || error.response.data.error || JSON.stringify(error.response.data).substring(0, 200);
        }
      }
      
      console.error(`\n${'='.repeat(80)}`);
      console.error(`❌ E-INVOICE GENERATION FAILED`);
      console.error(`${'='.repeat(80)}`);
      console.error(`   HTTP Status: ${errorStatus || 'No Response'}`);
      console.error(`   Error Code: ${error.code || 'Unknown'}`);
      console.error(`   Error Message: ${errorMsg}`);
      console.error(`   Full Error: ${error.message}`);
      
      // Detailed diagnostics for 403
      if (errorStatus === 403) {
        console.error(`\n🔐 HTTP 403 FORBIDDEN - Possible Causes:`);
        console.error(`   1. API KEY ISSUE:`);
        console.error(`      - Is GSTZEN_API_KEY set in .env? ${this.apiKey ? 'YES ✓' : 'NO ✗'}`);
        console.error(`      - API Key format (uuid): ${this.apiKey && this.apiKey.includes('-') ? 'YES ✓' : 'NO ✗'}`);
        console.error(`      - Correct Key: ${this.apiKey ? this.apiKey.substring(0, 12) + '...' : 'NOT SET'}`);
        console.error(`\n   2. POSSIBLE SOLUTIONS:`);
        console.error(`      a) Verify API key is correct (40+ chars, has dashes)`);
        console.error(`      b) Check if API key has EXPIRED on GSTZen account`);
        console.error(`      c) Check if API has PERMISSION to use /api/v1/invoice endpoint`);
        console.error(`      d) Try DELETING and REGENERATING the API key in GSTZen`);
        console.error(`      e) Contact GSTZen support: support@gstzen.in`);
        console.error(`      f) Check if your IP is WHITELISTED in GSTZen account settings`);
      }
      
      // Diagnostics for other errors
      if (errorStatus === 401 || errorStatus === 400) {
        console.error(`\n${errorStatus === 401 ? '🔐 HTTP 401 UNAUTHORIZED' : '🔧 HTTP 400 BAD REQUEST'}`);
        console.error(`   Check request headers and payload format`);
      }
      
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        console.error(`\n🌐 CONNECTION ERROR:`);
        console.error(`   Cannot reach ${this.baseUrl}`);
        console.error(`   Check GSTZEN_BASE_URL in .env`);
        console.error(`   Check internet connection`);
      }
      
      console.error(`${'='.repeat(80)}\n`);
      throw new Error(errorMsg || `Failed to generate E-Invoice`);
    }
  }

  /**
   * GENERATE E-WAY BILL
   * Generate e-way bill after invoice IRN is generated
   */
  async generateEWayBill(invoiceData, irnData) {
    try {
      console.log("📦 Generating E-Way Bill via GSTZen...");

      const payload = {
        irn: irnData.irn,
        docNo: String(invoiceData.invoiceNumber),
        docDt: this.formatDate(invoiceData.invoiceDate),
        docTyp: "INV",
        subSupTyp: "B2B",
        transMode: invoiceData.transportMode || "1", // 1=Road, 2=Rail, 3=Air, 4=Ship
        transDistance: invoiceData.transportDistance || 50,
        arrivalDate: this.formatDate(invoiceData.deliveryDate || new Date()),
        vehNo: invoiceData.vehicleNo || "",
        vehType: invoiceData.vehicleType || "REGULAR",
        shipDtls: {
          gstin: invoiceData.customer?.gstin || "URP",
          lglNm: invoiceData.customer?.name || "Buyer",
          addr1: invoiceData.customer?.address || "Address",
          loc: invoiceData.customer?.city || "CITY",
          pin: invoiceData.customer?.pincode || 0,
          stcd: invoiceData.customer?.stateCode || "33"
        },
        dispDtls: {
          nm: invoiceData.branchId?.name,
          addr1: invoiceData.branchId?.address1,
          loc: invoiceData.branchId?.city,
          pin: invoiceData.branchId?.pincode,
          stcd: invoiceData.branchId?.stateCode
        },
        itemList: invoiceData.items.map((item, idx) => ({
          slNo: idx + 1,
          hsnCd: item.productId?.hsnCode || "1000",
          qty: item.quantity,
          qtyUnit: item.unit || "NOS",
          netWt: item.weight || 0
        }))
      };

      console.log(`🔗 Calling GSTZen API: ${this.baseUrl}/EWB/Create`);
      const response = await this.apiClient.post("/EWB/Create", payload);

      if (response.data.success || response.data.status === 200 || response.data.status === "Success") {
        const result = response.data.data || response.data;
        return {
          success: true,
          ewayBillNo: result.ewayBillNo || result.ewbNo || result.EwbNo,
          ewayBillDate: result.ewayBillDate || result.ewbDt || result.EwbDt,
          ewayBillValidUntil: result.ewayBillValidUntil || result.ewbValidTill || result.EwbValidTill,
          responseData: result
        };
      } else {
        throw new Error(response.data.message || "E-Way Bill generation failed");
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      const errorCode = error.code;
      const errorStatus = error.response?.status;
      
      console.error("❌ E-Way Bill Error:");
      console.error("   URL:", `${this.baseUrl}/EWB/Create`);
      console.error("   HTTP Status:", errorStatus || "No response");
      console.error("   Error Code:", errorCode);
      console.error("   Error Message:", errorMsg);
      
      if (errorCode === "ENOTFOUND") {
        throw new Error(`Cannot reach GSTZen API at ${this.baseUrl}`);
      }
      
      throw new Error(errorMsg || error.message);
    }
  }

  /**
   * Helper: Format date to DD/MM/YYYY
   */
  formatDate(date) {
    if (typeof date === "string") {
      date = new Date(date);
    }
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * CANCEL E-INVOICE
   * Cancel previously generated e-invoice
   */
  async cancelEInvoice(irn, reason) {
    try {
      const response = await this.apiClient.post("/einvoice/cancel", {
        irn,
        reason
      });

      return response.data;
    } catch (error) {
      console.error("❌ Cancel E-Invoice Error:", error.response?.data || error.message);
      throw new Error(error.message);
    }
  }

  /**
   * CANCEL E-WAY BILL
   */
  async cancelEWayBill(ewayBillNo, reason) {
    try {
      const response = await this.apiClient.post("/ewaybill/cancel", {
        ewayBillNo,
        reason
      });

      return response.data;
    } catch (error) {
      console.error("❌ Cancel E-Way Bill Error:", error.response?.data || error.message);
      throw new Error(error.message);
    }
  }
}

export default new GSTZenService();
