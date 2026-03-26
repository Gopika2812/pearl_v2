import express from "express";
import axios from "axios";

const router = express.Router();

// GET /api/gst/search/:gstin
router.get("/search/:gstin", async (req, res) => {
  const { gstin } = req.params;

  if (!gstin || gstin.length !== 15) {
    return res.status(400).json({ message: "Invalid GSTIN format. Must be 15 characters." });
  }

  const apiKey = process.env.GST_API_KEY;

  // MOCK DATA FOR TESTING (if no API key provided)
  if (!apiKey || apiKey === "your_api_key_here" || !apiKey.trim()) {
    console.log("Using Mock GST Data for:", gstin);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Simple Mock logic based on GSTIN prefix (first 2 digits are state code)
    const stateMapping = {
      "33": "Tamil Nadu",
      "27": "Maharashtra",
      "29": "Karnataka",
      "32": "Kerala",
      "09": "Uttar Pradesh",
      "07": "Delhi",
      "37": "Andhra Pradesh",
      "36": "Telangana",
      "24": "Gujarat"
    };

    const stateCode = gstin.substring(0, 2);
    const state = stateMapping[stateCode] || "Other State";

    return res.json({
      success: true,
      source: "Mock Data (No API Key set in .env)",
      data: {
        legalName: "PEARLS ERP TEST BUSINESS LTD",
        tradeName: "PEARLS TRADING CO",
        gstin: gstin,
        status: "Active",
        registrationDate: "01/01/2020",
        taxpayerType: "Regular",
        address: "No 45, Industrial Estate, 4th Cross Street",
        city: "Chennai",
        district: "Chennai",
        state: state,
        pincode: "600032",
        centerJurisdiction: "COMMISSIONERATE CHENNAI",
        stateJurisdiction: "GUINDY CIRCLE"
      }
    });
  }

  try {
    // Example for a real API (e.g., gstapi.in)
    // You can adapt this based on the provider you choose
    const response = await axios.get(`https://gstapi.in/api/v1/search/${gstin}`, {
      headers: {
        "x-api-key": apiKey
      }
    });

    if (response.data && response.data.success) {
      const g = response.data.data;
      return res.json({
        success: true,
        data: {
          legalName: g.lgnm,
          tradeName: g.tradeNam || g.lgnm,
          gstin: g.gstin,
          status: g.sts,
          address: `${g.pradr?.addr?.bnm || ""}, ${g.pradr?.addr?.st || ""}, ${g.pradr?.addr?.loc || ""}`.replace(/^, /, "").trim(),
          city: g.pradr?.addr?.dst || "",
          state: g.pradr?.addr?.stcd || "",
          pincode: g.pradr?.addr?.pncd || ""
        }
      });
    } else {
      return res.status(404).json({ message: response.data?.message || "GSTIN not found or API error" });
    }
  } catch (err) {
    console.error("GST API Error:", err.message);
    return res.status(500).json({ message: "Failed to fetch GST details from server" });
  }
});

export default router;
