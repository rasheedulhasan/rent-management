import 'package:flutter_test/flutter_test.dart';
import 'package:rent_management_flutter/models/tenant.dart';

void main() {
  test('Tenant.fromJson parses a tenant list item', () {
    final tenant = Tenant.fromJson({
      '\$id': 'abc123',
      'full_name': 'John Doe',
      'phone_number': '+971500000000',
      'email': 'john@test.com',
      'room_id': 'room1',
      'monthly_rent': 2000,
      'status': 'active',
    });

    expect(tenant.id, 'abc123');
    expect(tenant.fullName, 'John Doe');
    expect(tenant.monthlyRent, 2000.0);
    expect(tenant.initials, 'JD');
  });
}
