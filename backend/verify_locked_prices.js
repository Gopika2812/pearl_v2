const API_BASE = 'http://localhost:5000/api';

async function testLockedPrices() {
  console.log('🚀 Starting Locked Price API Test...');

  const branchId = '65f1a2b3c4d5e6f7a8b9c0d1'; // Mock branch ID
  const customerId = '65f1a2b3c4d5e6f7a8b9c0d2'; // Mock customer ID
  const productId = '65f1a2b3c4d5e6f7a8b9c0d3'; // Mock product ID
  const lockedPrice = 550;

  try {
    // 1. Save Locked Price
    console.log('1. Saving Locked Price...');
    const saveRes = await fetch(`${API_BASE}/customer-locked-prices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branchId,
        customerId,
        productId,
        lockedPrice
      })
    });
    
    const saveText = await saveRes.text();
    let saveData;
    try {
      saveData = JSON.parse(saveText);
      console.log('✅ Save successful:', saveData.success);
    } catch (e) {
      console.error('❌ Save failed to parse JSON. Raw response:', saveText);
      return;
    }

    // 2. Fetch Locked Price
    console.log('2. Fetching Locked Price...');
    const fetchRes = await fetch(`${API_BASE}/customer-locked-prices/${customerId}/${productId}?branchId=${branchId}`);
    const fetchText = await fetchRes.text();
    let fetchData;
    try {
      fetchData = JSON.parse(fetchText);
      console.log('✅ Fetch successful:', fetchData.success);
      console.log('💰 Price matches:', fetchData.data.lockedPrice === lockedPrice);
    } catch (e) {
      console.error('❌ Fetch failed to parse JSON. Raw response:', fetchText);
      return;
    }

    // 3. Update Locked Price
    const newPrice = 600;
    console.log('3. Updating Locked Price...');
    await fetch(`${API_BASE}/customer-locked-prices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branchId,
        customerId,
        productId,
        lockedPrice: newPrice
      })
    });
    const updateFetchRes = await fetch(`${API_BASE}/customer-locked-prices/${customerId}/${productId}?branchId=${branchId}`);
    const updateFetchData = await updateFetchRes.json();
    console.log('✅ Update successful. New price:', updateFetchData.data.lockedPrice);
    console.log('💰 New price matches:', updateFetchData.data.lockedPrice === newPrice);

    console.log('\n🎉 All API tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testLockedPrices();
