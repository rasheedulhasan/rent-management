const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/health',
    method: 'GET',
    timeout: 5000
};

const req = http.request(options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log('Response:', json);
            if (res.statusCode === 200 && json.status === 'healthy') {
                console.log('✅ API health check passed!');
                process.exit(0);
            } else {
                console.log('❌ API health check failed');
                process.exit(1);
            }
        } catch (e) {
            console.error('Error parsing response:', e.message);
            process.exit(1);
        }
    });
});

req.on('error', (error) => {
    console.error('Error connecting to API:', error.message);
    console.log('Note: The server may not be running. Start it with: npm start');
    process.exit(1);
});

req.on('timeout', () => {
    console.error('Request timeout - server may not be running');
    req.destroy();
    process.exit(1);
});

req.end();