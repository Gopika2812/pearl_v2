import axios from "axios";

/**
 * MasterGST (WhiteBooks) API Service
 * 
 * This service handles communication with MasterGST for:
 * 1. Authentication (getting GSP access token)
 * 2. E-Invoice Registration (getting IRN)
 * 3. E-Way Bill Generation
 */

const MASTERGST_BASE_URL = "https://api.mastergst.com"; // Sandbox URL, use router.mastersindia.co for production if needed

class MasterGstService {
  constructor() {
    this.clientId = process.env.GST_CLIENT_ID;
    this.clientSecret = process.env.GST_CLIENT_SECRET;
    this.username = process.env.GST_NIC_USERNAME;
    this.password = process.env.GST_NIC_PASSWORD;
  }

  /**
   * Get Authentication Token from MasterGST
   */
  async getAuthToken() {
    try {
      if (!this.clientId || !this.clientSecret) {
        throw new Error("MasterGST Client ID/Secret missing in .env");
      }

      // Documentation indicates a specific auth flow for MasterGST
      // Usually POST to /oauth/token or similar
      const response = await axios.post(`${MASTERGST_BASE_URL}/oauth/token`, {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: "client_credentials"
      });

      return response.data.access_token;
    } catch (error) {
      console.error("MasterGST Auth Error:", error.response?.data || error.message);
      throw new Error("Failed to authenticate with MasterGST");
    }
  }

  /**
   * Register E-Invoice (Generate IRN)
   */
  async generateEInvoice(invoiceData) {
    try {
      const token = await this.getAuthToken();
      
      // Map Pearl ERP invoice data to MasterGST JSON Schema
      const payload = this.mapToGstSchema(invoiceData);

      const response = await axios.post(`${MASTERGST_BASE_URL}/einvoicing/generate`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          username: this.username,
          password: this.password,
          gstin: invoiceData.seller.gstin
        }
      });

      return response.data;
    } catch (error) {
      console.error("E-Invoice Generation Error:", error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Map Pearl ERP Invoice to Official Schema
   */
  mapToGstSchema(invoice) {
    // This will contain the complex mapping logic for 1.03 schema
    return {
      Version: "1.1",
      TranDtls: {
        TaxSch: "GST",
        SupTyp: "B2B", // Default to B2B
        RegRev: "N",
        EcmGstin: null
      },
      DocDtls: {
        Typ: "INV",
        No: invoice.invoiceNumber,
        Dt: invoice.invoiceDate.toISOString().split('T')[0].split('-').reverse().join('/')
      },
      SellerDtls: {
        Gstin: invoice.seller.gstin,
        LglNm: invoice.seller.name,
        Addr1: invoice.seller.address,
        Loc: "Tirunelveli",
        Pin: 627003,
        Stcd: "33"
      },
      BuyerDtls: {
        Gstin: invoice.customer.customerId?.gstin || "URP",
        LglNm: invoice.customer.name,
        Pos: "33",
        Addr1: invoice.customer.address,
        Loc: invoice.customer.district || "Default",
        Pin: parseInt(invoice.customer.pincode) || 627001,
        Stcd: "33"
      },
      ItemList: invoice.items.map((item, index) => ({
        SlNo: (index + 1).toString(),
        PrdDesc: item.name,
        IsServc: "N",
        HsnCd: item.hsn || "0000",
        Qty: item.qty,
        Unit: "UNT",
        UnitPrice: item.sellingPrice,
        TotAmt: item.sellingPrice * item.qty,
        Discount: item.discountAmount || 0,
        PreTaxVal: (item.sellingPrice * item.qty) - (item.discountAmount || 0),
        AssAmt: (item.sellingPrice * item.qty) - (item.discountAmount || 0),
        GstRt: item.gst || 0,
        CgstAmt: item.cgst || 0,
        SgstAmt: item.sgst || 0,
        IgstAmt: item.igst || 0,
        TotItemVal: item.total
      })),
      ValDtls: {
        AssVal: invoice.subtotal,
        CgstVal: invoice.totalTax.cgst,
        SgstVal: invoice.totalTax.sgst,
        IgstVal: invoice.totalTax.igst,
        CesVal: 0,
        StCesVal: 0,
        RndOffAmt: 0,
        TotInvVal: invoice.grandTotal
      }
    };
  }
}

export default new MasterGstService();
