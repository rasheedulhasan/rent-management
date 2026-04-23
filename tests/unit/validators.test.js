const Validators = require('../../src/utils/validators');

describe('Validators', () => {
  describe('isValidEmail', () => {
    test('returns true for valid email addresses', () => {
      expect(Validators.patterns.email.test('test@example.com')).toBe(true);
      expect(Validators.patterns.email.test('user.name@domain.co.uk')).toBe(true);
      expect(Validators.patterns.email.test('first.last@subdomain.example.org')).toBe(true);
    });

    test('returns false for invalid email addresses', () => {
      expect(Validators.patterns.email.test('invalid-email')).toBe(false);
      expect(Validators.patterns.email.test('@domain.com')).toBe(false);
      expect(Validators.patterns.email.test('user@')).toBe(false);
      expect(Validators.patterns.email.test('user@.com')).toBe(false);
      expect(Validators.patterns.email.test('')).toBe(false);
    });
  });

  describe('isValidPhone', () => {
    test('returns true for valid phone numbers', () => {
      // Note: The pattern only allows numbers with optional leading +
      expect(Validators.patterns.phone.test('+1234567890')).toBe(true);
      expect(Validators.patterns.phone.test('1234567890')).toBe(true);
      expect(Validators.patterns.phone.test('123')).toBe(true); // 3 digits is valid per pattern
    });

    test('returns false for invalid phone numbers', () => {
      expect(Validators.patterns.phone.test('abc-def-ghij')).toBe(false);
      expect(Validators.patterns.phone.test('123-456-7890')).toBe(false); // Has dashes
      expect(Validators.patterns.phone.test('')).toBe(false);
      expect(Validators.patterns.phone.test('0123456789')).toBe(false); // Starts with 0
      expect(Validators.patterns.phone.test('+')).toBe(false); // Just plus sign
    });
  });

  describe('isValidDate', () => {
    test('returns true for valid date strings', () => {
      expect(Validators.isValidDate('2023-12-31')).toBe(true);
      expect(Validators.isValidDate('2023-12-31T23:59:59Z')).toBe(true);
    });

    test('returns false for invalid date strings', () => {
      expect(Validators.isValidDate('invalid-date')).toBe(false);
      expect(Validators.isValidDate('2023-13-45')).toBe(false);
      expect(Validators.isValidDate('')).toBe(false);
    });
  });

  describe('isAlphanumeric', () => {
    test('returns true for alphanumeric strings with spaces, hyphens, underscores', () => {
      // Note: The pattern allows spaces, hyphens, and underscores
      expect(Validators.patterns.alphanumeric.test('abc123')).toBe(true);
      expect(Validators.patterns.alphanumeric.test('ABC123')).toBe(true);
      expect(Validators.patterns.alphanumeric.test('abc-123')).toBe(true);
      expect(Validators.patterns.alphanumeric.test('abc 123')).toBe(true);
      expect(Validators.patterns.alphanumeric.test('abc_123')).toBe(true);
    });

    test('returns false for non-alphanumeric strings', () => {
      expect(Validators.patterns.alphanumeric.test('abc@123')).toBe(false);
      expect(Validators.patterns.alphanumeric.test('')).toBe(false);
    });
  });

  describe('validateBuilding', () => {
    test('returns empty array for valid building data', () => {
      const validData = {
        name: 'Test Building',
        address: '123 Main St',
        total_floors: 5,
        total_rooms: 20
      };
      expect(Validators.validateBuilding(validData)).toEqual([]);
    });

    test('returns errors for missing required fields', () => {
      const invalidData = {
        name: 'Test Building'
        // missing address, total_floors, total_rooms
      };
      const errors = Validators.validateBuilding(invalidData);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors).toContain('address is required');
      expect(errors).toContain('total_floors is required');
      expect(errors).toContain('total_rooms is required');
    });

    test('returns errors for invalid data types', () => {
      const invalidData = {
        name: 'Test Building',
        address: '123 Main St',
        total_floors: 'five', // should be number
        total_rooms: 20
      };
      const errors = Validators.validateBuilding(invalidData);
      expect(errors).toContain('total_floors must be a positive integer');
    });
  });

  describe('validateRequired', () => {
    test('returns empty array when all required fields are present', () => {
      const data = { name: 'Test', email: 'test@example.com' };
      const requiredFields = ['name', 'email'];
      expect(Validators.validateRequired(requiredFields, data)).toEqual([]);
    });

    test('returns errors for missing required fields', () => {
      const data = { name: 'Test' };
      const requiredFields = ['name', 'email', 'phone'];
      const errors = Validators.validateRequired(requiredFields, data);
      expect(errors).toContain('email is required');
      expect(errors).toContain('phone is required');
      expect(errors).not.toContain('name is required');
    });
  });
});