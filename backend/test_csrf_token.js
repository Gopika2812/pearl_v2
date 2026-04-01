import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import dotenv from "dotenv";
import { CookieJar } from "tough-cookie";

dotenv.config();

const apiKey = process.env.GSTZEN_API_KEY?.trim() || "";
const baseUrl = process.env.GSTZEN_BASE_URL?.trim() || "https://my.gstzen.in";

console.log(`\n${'='.repeat(80)}`);
console.log(`🧪 GSTZen API - CSRF Token Test`);
console.log(`${'='.repeat(80)}`);

// Create cookie jar
const cookieJar = new CookieJar();

// Create axios client with cookies
const client = wrapper(axios.create({
  baseURL: baseUrl,
  timeout: 30000,
  jar: cookieJar,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json"
  },
  validateStatus: () => true
}));

async function testWithCSRFToken() {
  try {
    console.log(`\n📍 Step 1: Fetch initial page to get CSRF token...`);
    const initialResponse = await client.get("/");
    
    // Extract CSRF token from cookies
    const cookies = await cookieJar.getCookies(baseUrl);
    console.log(`   Cookies after GET /: ${cookies.length}`);
    
    let csrfToken = null;
    cookies.forEach(cookie => {
      console.log(`   - ${cookie.key}: ${cookie.value.substring(0, 20)}...`);
      if (cookie.key === 'csrftoken') {
        csrfToken = cookie.value;
      }
    });

    if (csrfToken) {
      console.log(`\n✓ CSRF Token found: ${csrfToken.substring(0, 20)}...`);
    } else {
      console.log(`\n⚠️  No CSRF token found in cookies`);
    }

    console.log(`\n📍 Step 2: Try POST with CSRF token in header...`);

    const testPayload = {
      DocDtls: {
        Typ: "INV",
        No: "TEST001",
        Dt: "01/01/2026"
      },
      SellerDtls: {
        Gstin: "33DULPS2600Q1Z6",
        LglNm: "Test Seller",
        Stcd: "33"
      },
      BuyerDtls: {
        Gstin: "URP",
        LglNm: "Test Buyer",
        Stcd: "33"
      },
      ItemList: [
        {
          SlNo: "1",
          HsnCd: "1000",
          Qty: 1,
          UnitPrice: 100,
          TaxRt: 18
        }
      ],
      ValDtls: {
        AssVal: 100,
        CgstVal: 9,
        SgstVal: 9,
        TotInvVal: 118
      }
    };

    // Try different header combinations
    const headerOptions = [
      { name: 'With X-CSRFToken', headers: { 'X-CSRFToken': csrfToken, 'Token': apiKey } },
      { name: 'With X-CSRF-Token', headers: { 'X-CSRF-Token': csrfToken, 'Token': apiKey } },
      { name: 'With Token only', headers: { 'Token': apiKey } },
      { name: 'With Authorization Bearer', headers: { 'Authorization': `Bearer ${apiKey}` } },
      { name: 'With Authorization Token', headers: { 'Authorization': `Token ${apiKey}` } }
    ];

    for (const option of headerOptions) {
      console.log(`\n📤 Trying: ${option.name}`);
      console.log(`   Headers: ${JSON.stringify(option.headers)}`);

      const response = await client.post("/api/v1/invoice", testPayload, {
        headers: option.headers
      });

      console.log(`   Status: ${response.status} ${response.statusText || ''}`);
      
      if (response.status === 403) {
        console.log(`   Result: ❌ 403 Forbidden`);
      } else if (response.status === 400) {
        console.log(`   Result: ⚠️  400 Bad Request (payload issue)`);
      } else if (response.status === 200 || response.status === 201) {
        console.log(`   Result: ✅ SUCCESS!`);
        console.log(`   Response:`, JSON.stringify(response.data).substring(0, 200));
      } else {
        console.log(`   Result: ℹ️  ${response.status}`);
      }

      if (response.status !== 403) {
        console.log(`\n🎉 Found working header combination!`);
        return;
      }
    }

  } catch (error) {
    console.error(`\n❌ Error:`, error.message);
  }

  console.log(`\n${'='.repeat(80)}\n`);
}

testWithCSRFToken();
