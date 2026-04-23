// Global test setup
process.env.NODE_ENV = 'test';

// Increase timeout for tests that might take longer
jest.setTimeout(10000);

// Mock console methods to keep test output clean
global.console = {
  ...console,
  // Uncomment to suppress specific console methods during tests
  // log: jest.fn(),
  // error: jest.fn(),
  // warn: jest.fn(),
};

// Clean up after all tests
afterAll(() => {
  // Add any cleanup logic here
});