import http from 'http';

const data = JSON.stringify({
  query: 'Who is present today?',
  branchId: '69cb755611501727ed6ec9cb'
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/ai-bot/query',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => console.log(body));
});

req.on('error', (e) => console.error(e));
req.write(data);
req.end();
