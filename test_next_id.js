const fetch = require('node-fetch');

async function testNextId() {
  const branchId = '66611f71a4f001db9c17dcd3'; // A known branch ID from previous logs or common
  const url = `http://localhost:5000/api/credit-notes/next-id?branchId=${branchId}`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log('Next ID Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error fetching next ID:', err.message);
  }
}

testNextId();
