import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5000/api';
const branchId = '69b6ae11c344418b6e011ce1';

async function testVoucherTypes() {
  try {
    console.log(`Testing GET ${API_BASE}/voucher-types/branch/${branchId}`);
    const res = await fetch(`${API_BASE}/voucher-types/branch/${branchId}`);
    const data = await res.json();
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (data.success && Array.isArray(data.data)) {
      console.log('✅ Success! Found', data.data.length, 'voucher types.');
    } else {
      console.log('❌ Failed! Unexpected response format.');
    }
  } catch (err) {
    console.error('❌ Error during test:', err.message);
  }
}

testVoucherTypes();
