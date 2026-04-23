const request = require('supertest');
const app = require('../../src/index');

describe('Health Endpoint', () => {
  test('GET /health returns healthy status', async () => {
    const response = await request(app).get('/health');
    
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('status', 'healthy');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('service', 'Rent Collection System API');
    expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
  });

  test('GET /health returns correct content type', async () => {
    const response = await request(app).get('/health');
    
    expect(response.headers['content-type']).toMatch(/json/);
  });
});

describe('404 Handler', () => {
  test('GET non-existent route returns 404', async () => {
    const response = await request(app).get('/non-existent-route');
    
    expect(response.statusCode).toBe(404);
    expect(response.body).toHaveProperty('error', 'Route not found');
    expect(response.body).toHaveProperty('path', '/non-existent-route');
  });

  test('POST to non-existent route returns 404', async () => {
    const response = await request(app).post('/api/non-existent');
    
    expect(response.statusCode).toBe(404);
    expect(response.body.error).toBe('Route not found');
  });
});

// Note: For more comprehensive API tests, you would need to:
// 1. Mock the Appwrite dependencies
// 2. Use a test database
// 3. Clean up test data after each test