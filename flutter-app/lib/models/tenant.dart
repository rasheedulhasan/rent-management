/// A tenant list item as returned by `GET /api/tenants`.
class Tenant {
  final String id;
  final String fullName;
  final String phoneNumber;
  final String email;
  final String roomId;
  final double monthlyRent;
  final String status;

  Tenant({
    required this.id,
    required this.fullName,
    required this.phoneNumber,
    required this.email,
    required this.roomId,
    required this.monthlyRent,
    required this.status,
  });

  factory Tenant.fromJson(Map<String, dynamic> json) {
    return Tenant(
      id: json['\$id'] as String? ?? json['id'] as String? ?? '',
      fullName: json['full_name'] as String? ?? '',
      phoneNumber: json['phone_number'] as String? ?? '',
      email: json['email'] as String? ?? '',
      roomId: json['room_id'] as String? ?? '',
      monthlyRent: (json['monthly_rent'] as num?)?.toDouble() ?? 0.0,
      status: json['status'] as String? ?? 'active',
    );
  }

  String get initials {
    if (fullName.isEmpty) return '?';
    final parts = fullName.trim().split(' ');
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    }
    return fullName[0].toUpperCase();
  }
}
