# Testing the Rent Management System

This document provides a quick start guide for testing the Rent Management System application.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment
Copy `.env.example` to `.env` and configure your Appwrite credentials.

### 3. Run Database Setup
```bash
npm run setup-db
```

### 4. Test the Application

#### Option A: Run API Health Check (Quick Test)
```bash
# Start the server
npm start

# In another terminal, run the health check
node test-api.js
```

#### Option B: Run Unit Tests
```bash
npm test
```

#### Option C: Run Specific Test Files
```bash
# Run validator tests only
npm test -- tests/unit/validators.test.js

# Run with coverage report
npm test -- --coverage
```

## Test Structure

```
tests/
├── unit/                    # Unit tests
│   └── validators.test.js  # Validator function tests
├── integration/            # Integration tests  
│   └── health.test.js      # API endpoint tests
├── setup.js               # Jest setup configuration
└── __mocks__/             # Mock files (to be created)
```

## Available Test Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run all Jest tests |
| `npm test -- --watch` | Run tests in watch mode |
| `npm test -- --coverage` | Run tests with coverage report |
| `node test-api.js` | Test API health endpoint |

## Writing New Tests

### 1. Unit Test Example
Create a new test file in `tests/unit/`:
```javascript
const MyModule = require('../../src/path/to/module');

describe('MyModule', () => {
  test('should do something', () => {
    expect(MyModule.someFunction()).toBe(expectedValue);
  });
});
```

### 2. Integration Test Example
Create a new test file in `tests/integration/`:
```javascript
const request = require('supertest');
const app = require('../../src/index');

describe('API Endpoint', () => {
  test('GET /api/resource returns data', async () => {
    const response = await request(app).get('/api/resource');
    expect(response.statusCode).toBe(200);
  });
});
```

## Testing Best Practices

1. **Mock External Dependencies**: Use Jest mocks for Appwrite, database, etc.
2. **Test Edge Cases**: Include tests for invalid inputs and error conditions.
3. **Keep Tests Independent**: Each test should run independently.
4. **Use Descriptive Names**: Test names should clearly describe what's being tested.

## Troubleshooting

### "No tests found"
- Ensure test files have `.test.js` or `.spec.js` extension
- Check `jest.config.js` for correct test match patterns

### API Health Check Fails
- Ensure server is running: `npm start`
- Check if port 3000 is available
- Verify `.env` configuration

### Appwrite Connection Issues
- Mock Appwrite in unit tests
- Use test Appwrite instance for integration tests

## Next Steps

1. Add more unit tests for services and utilities
2. Create integration tests for all API endpoints
3. Set up CI/CD with automated testing
4. Add end-to-end testing scenarios

For detailed testing guide, see [TESTING_GUIDE.md](TESTING_GUIDE.md).