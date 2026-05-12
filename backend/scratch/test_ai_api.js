import fetch from 'node-fetch';

async function test() {
  const res = await fetch('http://localhost:5000/api/ai-bot/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'Who is present today?',
      branchId: '69cb755611501727ed6ec9cb'
    })
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

test().catch(console.error);
