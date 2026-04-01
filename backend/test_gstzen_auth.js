import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import dotenv from "dotenv";
import { CookieJar } from "tough-cookie";

dotenv.config();

const apiKey = process.env.GSTZEN_API_KEY?.trim() || "";
const baseUrl = process.env.GSTZEN_BASE_URL?.trim() || "https://my.gstzen.in";

console.log(`\n${'='.repeat(80)}`);
console.log(`🧪 GSTZen API Authentication Test`);
console.log(`${'='.repeat(80)}`);
console.log(`\n📋 Configuration:`);
console.log(`   API Key Set: ${apiKey ? '✓ YES' : '✗ NO'}`);
console.log(`   API Key: ${apiKey ? apiKey.substring(0, 12) + '...' + apiKey.substring(apiKey.length - 4) : 'NOT SET'}`);
console.log(`   Base URL: ${baseUrl}`);
console.log(`   API Key Length: ${apiKey.length} chars`);
console.log(`   Has Dashes: ${apiKey.includes('-') ? 'YES ✓' : 'NO ✗'}`);

if (!apiKey) {
  console.error(`\n❌ ERROR: GSTZEN_API_KEY is not set in .env!`);
  process.exit(1);
}

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

// Add Token header
client.interceptors.request.use((config) => {
  config.headers["Token"] = apiKey;
  console.log(`\n📤 Request Headers Being Sent:`);
  console.log(`   Token: ${config.headers.Token ? config.headers.Token.substring(0, 12) + '...' : 'NOT SET'}`);
  console.log(`   Content-Type: ${config.headers['Content-Type']}`);
  console.log(`   URL: ${config.url}`);
  return config;
});

// Test with a simple status check or minimal payload
async function testGSTZenAuth() {
  try {
    console.log(`\n🔄 Testing E-Invoice endpoint with minimal payload...`);
    
    // First, try to just reach the API
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

    console.log(`\n📤 Sending Test Payload to: ${baseUrl}/api/v1/invoice`);
    const response = await client.post("/api/v1/invoice", testPayload);

    console.log(`\n✅ API Response Received`);
    console.log(`   Status Code: ${response.status}`);
    console.log(`   Status Text: ${response.statusText || 'N/A'}`);
    
    console.log(`\n📬 Response Headers:`);
    Object.entries(response.headers).forEach(([key, value]) => {
      if (key.toLowerCase() === 'set-cookie') {
        console.log(`   ${key}: [COOKIE RECEIVED] ✓`);
      } else if (key.toLowerCase() !== 'content-length') {
        console.log(`   ${key}: ${typeof value === 'string' ? value.substring(0, 80) : value}`);
      }
    });

    console.log(`\n📋 Response Body (first 500 chars):`);
    if (typeof response.data === 'string') {
      console.log(`   ${response.data.substring(0, 500)}`);
    } else {
      console.log(`   ${JSON.stringify(response.data, null, 2).substring(0, 500)}`);
    }

    // Analyze response
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 Analysis:`);
    console.log(`${'='.repeat(80)}`);

    if (response.status === 403) {
      console.log(`\n❌ HTTP 403 FORBIDDEN Received`);
      console.log(`\n🔍 Possible Issues:`);
      console.log(`   1. API Key is INVALID or EXPIRED`);
      console.log(`   2. API Key doesn't have PERMISSION for this endpoint`);
      console.log(`   3. IP address not WHITELISTED in GSTZen account`);
      console.log(`\n💡 Recommended Actions:`);
      console.log(`   1. Log into your GSTZen account at https://my.gstzen.in`);
      console.log(`   2. Check Settings → API Keys section`);
      console.log(`   3. Verify the API key is still ACTIVE`);
      console.log(`   4. Try REGENERATING a new API key`);
      console.log(`   5. Contact support: support@gstzen.in`);
    } else if (response.status === 200 || response.status === 201) {
      console.log(`\n✅ SUCCESS! API Key is working`);
      console.log(`   Your GSTZen API key is valid and authenticated`);
      console.log(`   The issue might be with the invoice payload data`);
    } else if (response.status === 400) {
      console.log(`\n⚠️  HTTP 400 BAD REQUEST Received`);
      console.log(`   API Key is working BUT payload format is invalid`);
      console.log(`   Check invoice data: GSTIN, HSN codes, GST rates`);
    } else if (response.status >= 500) {
      console.log(`\n❌ HTTP ${response.status} Server Error`);
      console.log(`   GSTZen server is having issues`);
      console.log(`   Try again in a few moments`);
    } else {
      console.log(`\n⚠️  HTTP ${response.status} Received`);
      console.log(`   Status: ${response.statusText}`);
    }

    // Check for cookies
    console.log(`\n🍪 Cookie Jar Status:`);
    try {
      const cookies = await cookieJar.getCookies(baseUrl);
      if (cookies.length > 0) {
        console.log(`   Cookies stored: ${cookies.length}`);
        cookies.forEach(cookie => {
          console.log(`   - ${cookie.key}: ${cookie.value.substring(0, 30)}...`);
        });
      } else {
        console.log(`   No cookies stored yet`);
      }
    } catch (e) {
      console.log(`   Error reading cookies: ${e.message}`);
    }

  } catch (error) {
    console.error(`\n❌ Test Failed`);
    console.error(`   Error: ${error.message}`);
    console.error(`   Code: ${error.code}`);
  }

  console.log(`\n${'='.repeat(80)}\n`);
}

testGSTZenAuth();