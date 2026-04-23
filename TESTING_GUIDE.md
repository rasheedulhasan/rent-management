# Testing Guide for Rent Management System

This guide explains how to test the Rent Management System application, which is a Node.js/Express backend with Appwrite database integration.

## Overview

The project has several testing approaches configured:
1. **Jest unit tests** (configured but no test files yet)
2. **API health check** (`test-api.js`)
3. **Manual API testing** with tools like Postman/cURL

## Available Testing Commands

### 1. Run Jest Tests
```bash
npm test
```
This runs Jest test suite. Currently, there are no test files, so this will show "No tests found".

### 2. Run API Health Check
```bash
node test-api.js
```
This tests if the API server is running and responding correctly on `/health` endpoint.

### 3. Start Development Server for Testing
```bash
npm run dev
```
Starts the server with nodemon for development and testing.

### 4. Start Production Server
```bash
npm start
```
Starts the server for production/testing.

## Setting Up Test Environment

### Prerequisites
1. Ensure Appwrite is running and configured (check `.env` file)
2. Run database setup:
   ```bash
   npm run setup-db
   ```
3. Start the server:
   ```bash
   npm start
   ```

### Environment Variables for Testing
Create a `.env.test` file for test-specific configurations:
```
NODE_ENV=test
PORT=3001
APPWRITE_ENDPOINT=http://localhost/v1
APPWRITE_PROJECT_ID=your_test_project_id
APPWRITE_API_KEY=your_test_api_key
DATABASE_ID=rent_management_test
```

## Testing Approaches

### 1. Unit Testing with Jest

#### Creating Your First Test
Create a test file for validators:
```bash
mkdir -p tests
touch tests/validators.test.js
```

Example test for `src/utils/validators.js`:
```javascript
const Validators = require('../src/utils/validators');

describe('Validators', () => {
  test('isValidEmail returns true for valid emails', () => {
    expect(Validators.isValidEmail('test@example.com')).toBe(true);
    expect(Validators.isValidEmail('user.name@domain.co.uk')).toBe(true);
  });

  test('isValidEmail returns false for invalid emails', () => {
    expect(Validators.isValidEmail('invalid-email')).toBe(false);
    expect(Validators.isValidEmail('@domain.com')).toBe(false);
  });

  test('isValidPhone validates phone numbers', () => {
    expect(Validators.isValidPhone('+1234567890')).toBe(true);
    expect(Validators.isValidPhone('123-456-7890')).toBe(true);
  });
});
```

#### Running Jest Tests
```bash
# Run all tests
npm test

# Run tests with coverage
npx jest --coverage

# Run specific test file
npx jest tests/validators.test.js

# Watch mode for development
npx jest --watch
```

### 2. Integration Testing (API Testing)

#### Using the Existing Health Check
The `test-api.js` file provides a basic health check:
```bash
# First start the server
npm start

# In another terminal, run the test
node test-api.js
```

Expected output:
```
✅ API health check passed!
```

#### Manual API Testing with cURL
```bash
# Health endpoint
curl http://localhost:3000/health

# Buildings endpoint
curl http://localhost:3000/api/buildings

# Create a building
curl -X POST http://localhost:3000/api/buildings \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Building", "address": "123 Test St"}'
```

#### Automated API Testing with Supertest
Create `tests/api.test.js`:
```javascript
const request = require('supertest');
const app = require('../src/index');

describe('API Endpoints', () => {
  test('GET /health returns healthy status', async () => {
    const response = await request(app).get('/health');
    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('healthy');
  });

  test('GET /api/buildings returns array', async () => {
    const response = await request(app).get('/api/buildings');
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
});
```

Install Supertest:
```bash
npm install --save-dev supertest
```

### 3. Service Layer Testing

Example test for `BaseService`:
```javascript
// tests/services/BaseService.test.js
const BaseService = require('../../src/services/BaseService');
const { databases } = require('../../src/config/appwrite');

// Mock Appwrite databases
jest.mock('../../src/config/appwrite', () => ({
  databases: {
    createDocument: jest.fn(),
    getDocument: jest.fn(),
    updateDocument: jest.fn(),
    deleteDocument: jest.fn(),
    listDocuments: jest.fn()
  },
  DATABASE_ID: 'test_db',
  ID: { unique: () => 'test-id-123' }
}));

describe('BaseService', () => {
  let service;

  beforeEach(() => {
    service = new BaseService('test_collection');
    jest.clearAllMocks();
  });

  test('create method calls databases.createDocument', async () => {
    const mockData = { name: 'Test' };
    const mockResponse = { id: '123', ...mockData };
    
    databases.createDocument.mockResolvedValue(mockResponse);

    const result = await service.create(mockData);

    expect(databases.createDocument).toHaveBeenCalledWith(
      'test_db',
      'test_collection',
      expect.any(String),
      mockData
    );
    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockResponse);
  });
});
```

## Test Directory Structure

Create the following test structure:
```
tests/
├── unit/
│   ├── utils/
│   │   └── validators.test.js
│   └── middleware/
│       └── validationMiddleware.test.js
├── integration/
│   ├── api.test.js
│   └── routes/
│       ├── buildingRoutes.test.js
│       └── tenantRoutes.test.js
├── services/
│   ├── BaseService.test.js
│   ├── BuildingService.test.js
│   └── TenantService.test.js
└── fixtures/
    └── test-data.json
```

## Mocking Dependencies

### Mocking Appwrite for Unit Tests
Create `tests/__mocks__/node-appwrite.js`:
```javascript
module.exports = {
  Client: jest.fn().mockImplementation(() => ({
    setEndpoint: jest.fn(),
    setProject: jest.fn(),
    setKey: jest.fn()
  })),
  Databases: jest.fn().mockImplementation(() => ({
    createDocument: jest.fn(),
    getDocument: jest.fn(),
    updateDocument: jest.fn(),
    deleteDocument: jest.fn(),
    listDocuments: jest.fn()
  })),
  ID: {
    unique: jest.fn(() => 'mock-id-' + Math.random().toString(36).substr(2, 9))
  },
  Query: {
    equal: jest.fn(),
    limit: jest.fn(),
    offset: jest.fn(),
    orderAsc: jest.fn(),
    orderDesc: jest.fn()
  }
};
```

## Continuous Integration

### GitHub Actions Example
Create `.github/workflows/test.yml`:
```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - name: API Health Check
        run: |
          npm start &
          sleep 5
          node test-api.js
```

## Testing Best Practices

1. **Isolate Tests**: Each test should be independent
2. **Mock External Dependencies**: Mock Appwrite, database calls
3. **Test Edge Cases**: Invalid inputs, error conditions
4. **Use Descriptive Test Names**: Clearly state what's being tested
5. **Keep Tests Fast**: Mock expensive operations
6. **Test Coverage**: Aim for 80%+ coverage of critical paths

## Common Test Scenarios

### 1. Validation Tests
- Test input validation for all API endpoints
- Test error responses for invalid data
- Test boundary conditions

### 2. Service Method Tests
- Test CRUD operations with mocked Appwrite
- Test error handling in service methods
- Test business logic in services

### 3. Route Integration Tests
- Test complete request/response cycle
- Test authentication/authorization (if implemented)
- Test middleware chain

### 4. Database Integration Tests
- Use test database for integration tests
- Clean up test data after each test
- Test transactions and data consistency

## Troubleshooting

### Jest "No tests found"
Solution: Create test files with `.test.js` or `.spec.js` extension

### API Health Check Fails
1. Ensure server is running: `npm start`
2. Check port configuration (default: 3000)
3. Verify `.env` file has correct Appwrite configuration

### Appwrite Connection Issues in Tests
1. Mock Appwrite dependencies in unit tests
2. Use test Appwrite instance for integration tests
3. Set appropriate environment variables

## Next Steps

1. Create basic unit tests for utility functions
2. Add integration tests for API endpoints
3. Set up CI/CD pipeline with automated testing
4. Add performance/load testing
5. Implement end-to-end testing scenarios

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Appwrite Testing Guide](https://appwrite.io/docs/testing)
- [Express Testing Best Practices](https://expressjs.com/en/guide/testing.html)