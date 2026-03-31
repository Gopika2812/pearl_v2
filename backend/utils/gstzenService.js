import axios from "axios";

/**
 * GSTZen E-Invoice & E-Way Bill Service
 * API Documentation: https://api.gstzen.in/docs
 */

class GSTZenService {
  constructor() {
    this.apiKey = process.env.GSTZEN_API_KEY;
    // GSTZen API endpoint - update based on your account type
    this.baseUrl = process.env.GSTZEN_BASE_URL || "https://gstzen.in/api";
    this.apiClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      }
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
        ValDtls: {
          AssVal: Number(invoiceData.subtotal || 0),
          CgstVal: Number(invoiceData.cgst || 0),
          SgstVal: Number(invoiceData.sgst || 0),
          IgstVal: Number(invoiceData.igst || 0),
          CesVal: Number(invoiceData.cess || 0),
          TotInvVal: Number(invoiceData.totalAmount || 0),
          Discount: Number(invoiceData.discountAmount || 0),
          OthChrg: Number(invoiceData.otherCharges || 0),
          RndOffAmt: Number(invoiceData.roundOff || 0),
          TotPayableAmt: Number(invoiceData.totalAmount || 0)
        },
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
      console.log(`🔗 Calling GSTZen API: ${this.baseUrl}${endpoint}`);
      console.log(`📤 Full Payload:`);
      console.log(JSON.stringify(payload, null, 2));
      
      const response = await this.apiClient.post(endpoint, payload);

      console.log(`✅ API Response Status:`, response.status);
      
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
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      const errorCode = error.code;
      const errorStatus = error.response?.status;
      
      console.error("❌ E-Invoice Error:");
      console.error("   URL:", `${this.baseUrl}/api/v1/invoice`);
      console.error("   HTTP Status:", errorStatus || "No response");
      console.error("   Error Code:", errorCode || "Unknown");
      console.error("   Error Message:", errorMsg);
      console.error("   API Response:", error.response?.data);
      
      // Detailed troubleshooting guide
      if (errorStatus === 400) {
        console.error("\n🔧 HTTP 400 - Bad Request (Invalid Data):");
        console.error("   This means GSTZen received the request but the data format is wrong");
        console.error("   Check:");
        console.error("   1. Is seller GSTIN correct? (15 digits)");
        console.error("   2. Does every product have HSN code?");
        console.error("   3. Are GST rates valid? (5, 12, 18, 28)");
        console.error("   4. Check above JSON payload for missing/wrong fields");
      } else if (errorStatus === 401 || errorStatus === 403) {
        console.error("\n🔐 Authentication Error:");
        console.error("   Check GSTZEN_API_KEY in .env");
      } else if (errorCode === "ENOTFOUND") {
        console.error("\n🌐 Connection Error:");
        console.error("   Check GSTZEN_BASE_URL in .env");
        console.error("   Check internet connection");
      }
      
      throw new Error(errorMsg || `Failed to generate E-Invoice: ${errorCode}`);
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
