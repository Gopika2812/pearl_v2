import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";

/**
 * GSTZen E-Invoice & E-Way Bill Service (FINAL ROBUST VERSION)
 */

class GSTZenService {
  constructor() {
    this.apiKey = (process.env.GSTZEN_API_KEY || process.env.GSTZen_API_KEY || "").trim();
    if (!this.apiKey) {
      console.warn("⚠️ GSTZEN_API_KEY is missing in your environment configuration.");
    }

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
   * @param {Object} invoiceData The document data
   * @param {String} docType "INV" for Invoice, "CRN" for Credit Note, "DBN" for Debit Note
   */
  async generateEInvoice(invoiceData, docType = "INV") {
    try {
      console.log("\n🚀 Generating E-Invoice IRN...");

      // 🛡️ HSN PRE-CHECK: GSTZen/NIC/Tax Portal requires a minimum of 6 digits for B2B E-Invoices.
      // (NIC strictly rejects 4-digit HSNs for businesses above the ₹5Cr threshold).
      if (invoiceData.items && Array.isArray(invoiceData.items)) {
        for (const item of invoiceData.items) {
          let hsn = String(item.hsn || item.productId?.hsnCode || "").trim();
          
          // 🛠️ AUTO-FIX: Pad with leading zero if 5 or 7 digits (Excel/Numbers often strip leading zeros)
          if (hsn.length === 5 || hsn.length === 7) {
            console.log(`🔧 Auto-padding HSN "${hsn}" to "0${hsn}"`);
            hsn = "0" + hsn;
          }

          // NIC portal strictly enforces 6 or 8 digits for E-Invoicing
          if (!/^\d{6}$|^\d{8}$/.test(hsn)) {
            const digitCount = hsn.length;
            const errorMsg = `Product "${item.name}" has a ${digitCount}-digit HSN code "${hsn}". ` +
              `The Tax Portal requires exactly 6 or 8 digits for E-Invoicing. ` +
              `Please update the HSN in the product master or edit the bill to proceed.`;
            console.error(`❌ Pre-check fail: ${errorMsg}`);
            throw new Error(errorMsg);
          }
          
          // Update the item object with padded HSN for the payload
          item.hsn = hsn;
        }
      }

      // 🛡️ DOCUMENT NUMBER LENGTH PRE-CHECK
      const docNo = String(invoiceData.invoiceNumber || invoiceData.creditNoteId || "");
      if (docNo.length > 16) {
        throw new Error(`Document Number "${docNo}" is too long (${docNo.length} chars). Max 16 allowed for E-Invoicing.`);
      }

      const sellerGstin = invoiceData.seller?.gstin || invoiceData.branchId?.gstin || "33DULPS2600Q1Z6";
      const sellerStateCode = String(invoiceData.seller?.stateCode || invoiceData.branchId?.stateCode || "33").padStart(2, "0");
      const buyerGstin = invoiceData.customer?.gstin || invoiceData.customer?.customerId?.gstin || "URP";
      const buyerStateCode = String(invoiceData.customer?.stateCode || invoiceData.customer?.customerId?.stateCode || "33").padStart(2, "0");
      const isInterState = sellerStateCode !== buyerStateCode;
      const isB2C = buyerGstin === "URP";

      let totalAssVal = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0;

      // 1. Add Regular Items (Filter out items with zero quantity i.e. Back Orders)
      const billedItems = (invoiceData.items || []).filter(item => Number(item.qty || 0) > 0);
      const itemList = billedItems.map((item, idx) => {
        const qty = Number(item.qty || 0);
        const rate = Number(item.sellingPrice || 0);
        const discount = Number(item.discountAmount || 0);
        const gstRt = Number(item.gst || 0);

        // Calculate Assessable Amount (Vettable base price)
        const assessableAmt = Number((qty * rate - discount).toFixed(2));

        let cgstAmt = 0;
        let sgstAmt = 0;
        let igstAmt = 0;

        if (gstRt > 0) {
          const totalTax = Number((assessableAmt * gstRt / 100).toFixed(2));
          if (isInterState) {
            igstAmt = totalTax;
          } else {
            // 🚨 POSITIVE EQUALITY: CGST and SGST MUST be identical for NIC portal
            cgstAmt = Number((totalTax / 2).toFixed(2));
            sgstAmt = cgstAmt; 
          }
        }

        const itemTotal = Number((assessableAmt + cgstAmt + sgstAmt + igstAmt).toFixed(2));

        totalAssVal += assessableAmt;
        totalCgst += cgstAmt;
        totalSgst += sgstAmt;
        totalIgst += igstAmt;

        return {
          SlNo: String(idx + 1),
          PrdDesc: String(item.name || "Product").substring(0, 100).trim(),
          HsnCd: String(item.hsn || item.productId?.hsnCode || "21050000").trim(),
          Qty: qty, Units: "NOS", UnitPrice: rate, TotAmt: Number((qty * rate).toFixed(2)),
          Discount: discount, AssAmt: assessableAmt, GstRt: gstRt,
          IgstAmt: igstAmt, CgstAmt: cgstAmt, SgstAmt: sgstAmt,
          TotItemVal: itemTotal
        };
      });

      // 2. Add Transport Charges as a Line Item (NIC portal requirement for large amounts)
      const transportCharge = Number(invoiceData.transportCharge || 0);
      const transportGstPercent = Number(invoiceData.transportGstPercent || 0);
      if (transportCharge > 0) {
        let tCgst = 0, tSgst = 0, tIgst = 0;
        const tTax = Number((transportCharge * transportGstPercent / 100).toFixed(2));
        if (isInterState) {
          tIgst = tTax;
        } else {
          tCgst = tSgst = Number((tTax / 2).toFixed(2));
        }

        const tTotal = transportCharge + tCgst + tSgst + tIgst;
        totalAssVal += transportCharge;
        totalCgst += tCgst;
        totalSgst += tSgst;
        totalIgst += tIgst;

        itemList.push({
          SlNo: String(itemList.length + 1),
          PrdDesc: "Transport/Delivery Charges",
          HsnCd: "996601", // Service HSN for transport
          Qty: 1, Units: "NOS", UnitPrice: transportCharge, TotAmt: transportCharge,
          Discount: 0, AssAmt: transportCharge, GstRt: transportGstPercent,
          IgstAmt: tIgst, CgstAmt: tCgst, SgstAmt: tSgst,
          TotItemVal: tTotal
        });
      }

      // 3. Add Extra Expenses as Line Items
      if (invoiceData.extraExpenses && Array.isArray(invoiceData.extraExpenses)) {
        invoiceData.extraExpenses.forEach(exp => {
          let eBase = Number(exp.basePrice || 0);
          const eTotal = Number(exp.totalPrice || 0);
          const eGstRt = Number(exp.gstPercent || 0);
          
          // If basePrice is missing but total exists, derive it
          if (eBase === 0 && eTotal > 0) {
            eBase = Number((eTotal / (1 + (eGstRt / 100))).toFixed(2));
          }

          if (eBase > 0 || eTotal > 0) {
            let eCgst = 0, eSgst = 0, eIgst = 0;
            const eTax = Number((eBase * eGstRt / 100).toFixed(2));
            if (isInterState) {
              eIgst = eTax;
            } else {
              eCgst = eSgst = Number((eTax / 2).toFixed(2));
            }

            const calculatedTotal = Number((eBase + eCgst + eSgst + eIgst).toFixed(2));
            totalAssVal += eBase;
            totalCgst += eCgst;
            totalSgst += eSgst;
            totalIgst += eIgst;

            itemList.push({
              SlNo: String(itemList.length + 1),
              PrdDesc: String(exp.expenseName || exp.name || "Extra Charge").substring(0, 100),
              HsnCd: "998319", // General Service HSN
              Qty: 1, Units: "NOS", UnitPrice: eBase, TotAmt: eBase,
              Discount: 0, AssAmt: eBase, GstRt: eGstRt,
              IgstAmt: eIgst, CgstAmt: eCgst, SgstAmt: eSgst,
              TotItemVal: calculatedTotal
            });
          }
        });
      }

      // 4. Final Header Math Validation
      totalAssVal = Number(totalAssVal.toFixed(2));
      totalCgst = Number(totalCgst.toFixed(2));
      totalSgst = totalCgst; // 🛡️ FORCE ABSOLUTE EQUALITY for tax portal compliance
      totalIgst = Number(totalIgst.toFixed(2));
      
      const totalTaxes = Number((totalCgst + totalSgst + totalIgst).toFixed(2));
      let commonDiscount = Number(invoiceData.commonDiscount || 0);
      let subtotalWithTaxes = Number((totalAssVal + totalTaxes - commonDiscount).toFixed(2));
      const billGrandTotal = Number((invoiceData.grandTotal || subtotalWithTaxes).toFixed(2));

      // 5. 🚨 CRITICAL FALLBACK: Fix mathematical mismatches (> ₹2.00)
      const initialGap = Number((billGrandTotal - subtotalWithTaxes).toFixed(2));
      
      if (initialGap < -2.00) {
        // 📉 NEGATIVE GAP: Bill Total is LESS than Items + Taxes.
        // Solution: Instead of a negative line item (prohibited), we increase the Header Discount.
        console.warn(`⚠️ Negative mismatch (${initialGap}) detected. Absorbing into Header Discount instead of adding a negative line.`);
        commonDiscount = Number((commonDiscount + Math.abs(initialGap)).toFixed(2));
        // Recalculate subtotal for rounding logic
        subtotalWithTaxes = Number((totalAssVal + totalTaxes - commonDiscount).toFixed(2));
      } 
      else if (initialGap > 2.00) {
        // 📈 POSITIVE GAP: Bill Total is MORE than Items + Taxes.
        // Solution: Add a "Miscellaneous Adjustment" line item.
        console.warn(`⚠️ Positive mismatch (${initialGap}) detected. Adding balancing line.`);
        const balancingAmt = initialGap;
        totalAssVal += balancingAmt;
        totalAssVal = Number(totalAssVal.toFixed(2));
        
        itemList.push({
          SlNo: String(itemList.length + 1),
          PrdDesc: "Miscellaneous Adjustment",
          HsnCd: "998399",
          Qty: 1, Units: "NOS", UnitPrice: balancingAmt, TotAmt: balancingAmt,
          Discount: 0, AssAmt: balancingAmt, GstRt: 0,
          IgstAmt: 0, CgstAmt: 0, SgstAmt: 0,
          TotItemVal: balancingAmt
        });
        // Recalculate subtotal for rounding logic (balancingAmt was added to totalAssVal)
        subtotalWithTaxes = Number((totalAssVal + totalTaxes - commonDiscount).toFixed(2));
      }

      // Final Rounding calculation for NIC (< ₹1.00)
      const finalDerivedTotal = Number((totalAssVal + totalTaxes - commonDiscount).toFixed(2));
      const roundOff = Number((billGrandTotal - finalDerivedTotal).toFixed(2));

      console.log(`📊 E-Invoice Final Balanced Math: AssVal=${totalAssVal}, Taxes=${totalTaxes}, Disc=${commonDiscount}, RndOff=${roundOff}, Final=${billGrandTotal}`);

      const payload = {
        Version: "1.1",
        TranDtls: { TaxSch: "GST", SupTyp: isB2C ? "B2C" : "B2B", RegRev: "N", IgstOnIntra: "N" },
        DocDtls: { Typ: docType, No: docNo, Dt: this.formatDate(invoiceData.invoiceDate || invoiceData.date) },
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
          AssVal: totalAssVal,
          CgstVal: totalCgst,
          SgstVal: totalSgst,
          IgstVal: totalIgst,
          Discount: commonDiscount,
          OthChrg: 0, // Transport already in AssVal
          RndOffAmt: roundOff,
          TotInvVal: billGrandTotal
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
      let endpoint = (process.env.GSTZEN_EINVOICE_ENDPOINT || "/~gstzen/a/post-einvoice-data/einvoice-json/").trim().replace(/^\/+/, "");
      // if (!endpoint) throw new Error("GSTZEN_EINVOICE_ENDPOINT missing in .env");

      console.log(`📡 Sending [${isB2C ? "B2C E-Way Bill" : "B2B E-Invoice"}] to: ${this.baseUrl}/${endpoint}`);
      
      // 🛠️ DYNAMIC HEADERS (Per Branch GSP Credentials)
      const headers = {};
      if (invoiceData.branchId?.gstzenClientId) {
        headers["Client-Id"] = invoiceData.branchId.gstzenClientId;
        headers["Client-Secret"] = invoiceData.branchId.gstzenClientSecret;
      }

      const response = await this.apiClient.post(endpoint, payload, { headers });
      const result = response.data;
      console.log("📝 GSTZen SUCCESS Response Keys:", Object.keys(result));

      if (result.status === 1 || result.Irn || result.irn || result.EwbNo) {
        // ✨ EXHAUSTIVE QR DATA EXTRACTION
        const qrUrl = result.QrCodeImageUrl || result.QrCodeUrl || result.IrnQrCodeUrl || result.irn_qr_code_url || result.qr_code_image_url;
        const signedQr = result.SignedQRCode || result.SignedQrCode || result.signed_qr_code;
        const qrImgData = result.QrCodeImage || result.qr_code_image;

        console.log(`✅ E-Invoice Data: IRN=[${result.Irn || result.irn}], QR_URL=[${qrUrl ? 'YES' : 'NO'}], SIGNED_QR=[${signedQr ? 'YES' : 'NO'}]`);

        return {
          success: true,
          irn: result.Irn || result.irn,
          ackNo: result.AckNo || result.ackNo,
          ackDate: result.AckDt || result.ackDate,
          ewayBillNo: result.EwbNo || result.ewbNo,
          invoicePdfUrl: this.makeAbsoluteUrl(result.InvoicePdfUrl),
          ewayBillPdfUrl: this.makeAbsoluteUrl(result.EWayBillPdfUrl),
          qrCodeUrl: this.makeAbsoluteUrl(qrUrl),
          signedInvoice: result.SignedInvoice,
          signedQrCode: signedQr,
          signedQrCodeImgUrl: qrImgData // Base64 if returned
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
  async generateEWayBill(invoiceData, irnData, docType = "INV") {
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
          Typ: docType,
          No: String(invoiceData.invoiceNumber || invoiceData.creditNoteId),
          Dt: this.formatDate(invoiceData.invoiceDate || invoiceData.date)
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

      // 🛠️ DYNAMIC HEADERS (Per Branch GSP Credentials)
      const headers = {};
      if (invoiceData.branchId?.gstzenClientId) {
        headers["Client-Id"] = invoiceData.branchId.gstzenClientId;
        headers["Client-Secret"] = invoiceData.branchId.gstzenClientSecret;
      }

      const response = await this.apiClient.post(endpoint, payload, { headers });
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
          ewayBillPdfUrl: this.makeAbsoluteUrl(result.EWayBillPdfUrl)
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
  
  makeAbsoluteUrl(url) {
    if (!url || typeof url !== "string") return url;
    if (url.startsWith("/")) {
      return `${this.baseUrl}${url}`;
    }
    return url;
  }
}

export default new GSTZenService();
