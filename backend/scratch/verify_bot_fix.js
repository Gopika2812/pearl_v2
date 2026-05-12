import http from 'http';

async function getAuthToken() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      username: 'superadmin',
      password: 'SuperAdmin@123'
    });

    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/super-admin/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.success) resolve(parsed.token);
          else reject(new Error(parsed.message || 'Login failed'));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function testBot(token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      query: 'Who is present today?',
      branchId: '69b6ae11c344418b6e011ce1' // The known mismatched ID
    });

    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/ai-bot/query',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'Authorization': `Bearer ${token}`
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  try {
    console.log('Logging in...');
    const token = await getAuthToken();
    console.log('Token acquired. Testing bot...');
    const result = await testBot(token);
    console.log('Bot Response:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('Test failed:', e.message);
  }
}

run();
