/// Represents the full tenant detail response from the backend API.
class TenantDetailResponse {
  final bool success;
  final TenantDetailData? data;

  TenantDetailResponse({required this.success, this.data});

  factory TenantDetailResponse.fromJson(Map<String, dynamic> json) {
    return TenantDetailResponse(
      success: json['success'] as bool? ?? false,
      data: json['data'] != null
          ? TenantDetailData.fromJson(json['data'] as Map<String, dynamic>)
          : null,
    );
  }
}

/// Core data container for the tenant detail view.
class TenantDetailData {
  final TenantProfile tenant;
  final RoomInfo? room;
  final BuildingInfo? building;
  final LeaseSummary lease;
  final FinancialHealth financial;
  final List<RentLedgerEntry> recentTransactions;
  final String statusBadge;

  TenantDetailData({
    required this.tenant,
    this.room,
    this.building,
    required this.lease,
    required this.financial,
    required this.recentTransactions,
    required this.statusBadge,
  });

  factory TenantDetailData.fromJson(Map<String, dynamic> json) {
    return TenantDetailData(
      tenant: TenantProfile.fromJson(json['tenant'] as Map<String, dynamic>),
      room: json['room'] != null
          ? RoomInfo.fromJson(json['room'] as Map<String, dynamic>)
          : null,
      building: json['building'] != null
          ? BuildingInfo.fromJson(json['building'] as Map<String, dynamic>)
          : null,
      lease: LeaseSummary.fromJson(json['lease'] as Map<String, dynamic>),
      financial:
          FinancialHealth.fromJson(json['financial'] as Map<String, dynamic>),
      recentTransactions: (json['recent_transactions'] as List<dynamic>? ?? [])
          .map((e) =>
              RentLedgerEntry.fromJson(e as Map<String, dynamic>))
          .toList(),
      statusBadge: json['status_badge'] as String? ?? 'active',
    );
  }

  /// Pre-computed display name combining building and room number.
  String get propertyDisplayName {
    if (building != null && room != null) {
      return '${building!.name} — Unit ${room!.roomNumber}';
    } else if (room != null) {
      return 'Unit ${room!.roomNumber}';
    }
    return 'N/A';
  }
}

/// Core tenant profile fields.
class TenantProfile {
  final String id;
  final String fullName;
  final String phoneNumber;
  final String email;
  final String idNumber;
  final String emergencyContact;
  final String status;
  final String? checkInDate;
  final String? checkOutDate;
  final double monthlyRent;
  final double securityDeposit;
  final int? billingDay;
  final String? lastPaymentDate;
  final String notes;
  final String createdAt;

  TenantProfile({
    required this.id,
    required this.fullName,
    required this.phoneNumber,
    required this.email,
    required this.idNumber,
    required this.emergencyContact,
    required this.status,
    this.checkInDate,
    this.checkOutDate,
    required this.monthlyRent,
    required this.securityDeposit,
    this.billingDay,
    this.lastPaymentDate,
    required this.notes,
    required this.createdAt,
  });

  factory TenantProfile.fromJson(Map<String, dynamic> json) {
    return TenantProfile(
      id: json['id'] as String? ?? '',
      fullName: json['full_name'] as String? ?? '',
      phoneNumber: json['phone_number'] as String? ?? '',
      email: json['email'] as String? ?? '',
      idNumber: json['id_number'] as String? ?? '',
      emergencyContact: json['emergency_contact'] as String? ?? '',
      status: json['status'] as String? ?? 'active',
      checkInDate: json['check_in_date'] as String?,
      checkOutDate: json['check_out_date'] as String?,
      monthlyRent: (json['monthly_rent'] as num?)?.toDouble() ?? 0.0,
      securityDeposit: (json['security_deposit'] as num?)?.toDouble() ?? 0.0,
      billingDay: json['billing_day'] as int?,
      lastPaymentDate: json['last_payment_date'] as String?,
      notes: json['notes'] as String? ?? '',
      createdAt: json['created_at'] as String? ?? '',
    );
  }

  /// Returns initials from the full name for avatar display.
  String get initials {
    if (fullName.isEmpty) return '?';
    final parts = fullName.trim().split(' ');
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    }
    return fullName.isNotEmpty ? fullName[0].toUpperCase() : '?';
  }
}

/// Room information associated with the tenant.
class RoomInfo {
  final String id;
  final String roomNumber;
  final int floor;
  final String type;
  final double monthlyRent;

  RoomInfo({
    required this.id,
    required this.roomNumber,
    required this.floor,
    required this.type,
    required this.monthlyRent,
  });

  factory RoomInfo.fromJson(Map<String, dynamic> json) {
    return RoomInfo(
      id: json['id'] as String? ?? '',
      roomNumber: json['room_number'] as String? ?? '',
      floor: json['floor'] as int? ?? 0,
      type: json['type'] as String? ?? 'apartment',
      monthlyRent: (json['monthly_rent'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

/// Building information.
class BuildingInfo {
  final String name;

  BuildingInfo({required this.name});

  factory BuildingInfo.fromJson(Map<String, dynamic> json) {
    return BuildingInfo(
      name: json['name'] as String? ?? '',
    );
  }
}

/// Lease summary details.
class LeaseSummary {
  final String? startDate;
  final String? endDate;
  final int? daysRemaining;
  final double monthlyRent;
  final double securityDeposit;

  LeaseSummary({
    this.startDate,
    this.endDate,
    this.daysRemaining,
    required this.monthlyRent,
    required this.securityDeposit,
  });

  factory LeaseSummary.fromJson(Map<String, dynamic> json) {
    return LeaseSummary(
      startDate: json['start_date'] as String?,
      endDate: json['end_date'] as String?,
      daysRemaining: json['days_remaining'] as int?,
      monthlyRent: (json['monthly_rent'] as num?)?.toDouble() ?? 0.0,
      securityDeposit:
          (json['security_deposit'] as num?)?.toDouble() ?? 0.0,
    );
  }

  bool get isEnded => daysRemaining == 0;

  bool get isPermanent => endDate == null;
}

/// Financial health summary.
class FinancialHealth {
  final double outstandingBalance;
  final double totalPending;
  final double totalOverdue;
  final String? nextPaymentDueDate;

  FinancialHealth({
    required this.outstandingBalance,
    required this.totalPending,
    required this.totalOverdue,
    this.nextPaymentDueDate,
  });

  factory FinancialHealth.fromJson(Map<String, dynamic> json) {
    return FinancialHealth(
      outstandingBalance:
          (json['outstanding_balance'] as num?)?.toDouble() ?? 0.0,
      totalPending: (json['total_pending'] as num?)?.toDouble() ?? 0.0,
      totalOverdue: (json['total_overdue'] as num?)?.toDouble() ?? 0.0,
      nextPaymentDueDate: json['next_payment_due_date'] as String?,
    );
  }

  bool get hasOutstanding => outstandingBalance > 0;
}

/// A single rent ledger entry.
class RentLedgerEntry {
  final String ledgerId;
  final int periodMonth;
  final int periodYear;
  final String rentPeriod;
  final String? rentDueDate;
  final double amountDue;
  final double amountPaid;
  final double pendingBalance;
  final double monthlyRent;
  final String status;
  final String paymentStatus;
  final String? createdAt;

  RentLedgerEntry({
    required this.ledgerId,
    required this.periodMonth,
    required this.periodYear,
    required this.rentPeriod,
    this.rentDueDate,
    required this.amountDue,
    required this.amountPaid,
    required this.pendingBalance,
    required this.monthlyRent,
    required this.status,
    required this.paymentStatus,
    this.createdAt,
  });

  factory RentLedgerEntry.fromJson(Map<String, dynamic> json) {
    return RentLedgerEntry(
      ledgerId: json['ledger_id'] as String? ?? '',
      periodMonth: json['period_month'] as int? ?? 1,
      periodYear: json['period_year'] as int? ?? DateTime.now().year,
      rentPeriod: json['rent_period'] as String? ?? '',
      rentDueDate: json['rent_due_date'] as String?,
      amountDue: (json['amount_due'] as num?)?.toDouble() ?? 0.0,
      amountPaid: (json['amount_paid'] as num?)?.toDouble() ?? 0.0,
      pendingBalance:
          (json['pending_balance'] as num?)?.toDouble() ?? 0.0,
      monthlyRent: (json['monthly_rent'] as num?)?.toDouble() ?? 0.0,
      status: json['status'] as String? ?? 'pending',
      paymentStatus: json['payment_status'] as String? ?? 'pending',
      createdAt: json['created_at'] as String?,
    );
  }

  /// Returns a human-readable period label like "May 2026".
  String get periodLabel {
    final month = DateTime(periodYear, periodMonth);
    final months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return '${months[periodMonth - 1]} $periodYear';
  }

  /// Returns true if this entry is fully paid.
  bool get isPaid => paymentStatus == 'paid';

  /// Returns true if this entry is overdue.
  bool get isOverdue => paymentStatus == 'overdue';

  /// Returns true if this entry is partially paid.
  bool get isPartial => paymentStatus == 'partial';
}
