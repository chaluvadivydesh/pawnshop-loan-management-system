const http = require('http');

function testEndpoint(path) {
  return new Promise((resolve) => {
    const start = Date.now();
    http.get(`http://localhost:5001${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const duration = Date.now() - start;
        console.log(`[${res.statusCode}] ${path} - ${duration}ms (Payload: ${(data.length / 1024).toFixed(2)} KB)`);
        resolve(duration);
      });
    }).on('error', (err) => {
      console.error(`[ERR] ${path} - ${err.message}`);
      resolve(-1);
    });
  });
}

(async () => {
  console.log('=== BENCHMARKING BACKEND API ENDPOINTS (CALL 1 vs CALL 2) ===');
  console.log('\n--- FIRST CALL ---');
  await testEndpoint('/api/reports/dashboard');
  await testEndpoint('/api/customers');
  await testEndpoint('/api/reports/due-loans');
  await testEndpoint('/api/reports/financial');
  await testEndpoint('/api/reports/todays-analysis');

  console.log('\n--- SECOND CALL (IMMEDIATE REPEAT) ---');
  await testEndpoint('/api/reports/dashboard');
  await testEndpoint('/api/customers');
  await testEndpoint('/api/reports/due-loans');
  await testEndpoint('/api/reports/financial');
  await testEndpoint('/api/reports/todays-analysis');
  console.log('===========================================================');
})();
