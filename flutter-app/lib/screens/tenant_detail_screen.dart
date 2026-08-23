import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/tenant_detail_model.dart';
import '../providers/tenant_detail_provider.dart';

/// Entry point: call this from the list view on tenant tap:
///   Navigator.push(
///     context,
///     MaterialPageRoute(
///       builder: (_) => TenantDetailScreen(tenantId: tenant.id),
///     ),
///   );
class TenantDetailScreen extends StatefulWidget {
  final String tenantId;

  const TenantDetailScreen({super.key, required this.tenantId});

  @override
  State<TenantDetailScreen> createState() => _TenantDetailScreenState();
}

class _TenantDetailScreenState extends State<TenantDetailScreen> {
  @override
  void initState() {
    super.initState();
    // Fetch tenant details on screen entry
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context
          .read<TenantDetailProvider>()
          .fetchTenantById(widget.tenantId);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<TenantDetailProvider>(
      builder: (context, provider, _) {
        switch (provider.state) {
          case TenantDetailState.initial:
          case TenantDetailState.loading:
            return _buildLoadingView();
          case TenantDetailState.error:
            return _buildErrorView(provider);
          case TenantDetailState.loaded:
            if (provider.data != null) {
              return _buildDetailView(context, provider.data!);
            }
            return _buildErrorView(provider);
        }
      },
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Loading View
  // ───────────────────────────────────────────────────────────────────────────
  Widget _buildLoadingView() {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A237E),
        foregroundColor: Colors.white,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text('Tenant Details'),
      ),
      body: const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(strokeWidth: 3),
            SizedBox(height: 16),
            Text(
              'Loading tenant details…',
              style: TextStyle(
                color: Colors.grey,
                fontSize: 14,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Error View
  // ───────────────────────────────────────────────────────────────────────────
  Widget _buildErrorView(TenantDetailProvider provider) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A237E),
        foregroundColor: Colors.white,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text('Tenant Details'),
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.error_outline_rounded,
                size: 64,
                color: Colors.red[300],
              ),
              const SizedBox(height: 16),
              Text(
                provider.errorMessage ?? 'Something went wrong',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 16,
                  color: Colors.black54,
                ),
              ),
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: provider.retry,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Detail View — The main scrollable body
  // ───────────────────────────────────────────────────────────────────────────
  Widget _buildDetailView(BuildContext context, TenantDetailData data) {
    final currencyFormat = NumberFormat.currency(symbol: 'KSh ', decimalDigits: 0);

    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      body: CustomScrollView(
        slivers: [
          // ── App Bar ──
          SliverAppBar(
            expandedHeight: 200,
            floating: false,
            pinned: true,
            backgroundColor: const Color(0xFF1A237E),
            foregroundColor: Colors.white,
            flexibleSpace: FlexibleSpaceBar(
              background: _buildProfileHeader(data, currencyFormat),
            ),
            leading: IconButton(
              icon: const Icon(Icons.arrow_back_rounded),
              onPressed: () => Navigator.of(context).pop(),
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.more_vert_rounded),
                onPressed: () => _showActionMenu(context, data),
              ),
            ],
          ),

          // ── Body Content ──
          SliverPadding(
            padding: const EdgeInsets.all(16),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                // 1. Contact Info Card
                _buildContactCard(data),
                const SizedBox(height: 16),

                // 2. Lease Summary Card
                _buildLeaseCard(data, currencyFormat),
                const SizedBox(height: 16),

                // 3. Financial Health Card
                _buildFinancialCard(data, currencyFormat),
                const SizedBox(height: 16),

                // 4. Recent Transactions
                _buildRecentTransactionsSection(data, currencyFormat),
                const SizedBox(height: 100), // Bottom bar clearance
              ]),
            ),
          ),
        ],
      ),

      // ── Bottom Action Bar ──
      bottomNavigationBar: _buildBottomActionBar(context, data),
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Profile Header (inside the SliverAppBar flexible space)
  // ───────────────────────────────────────────────────────────────────────────
  Widget _buildProfileHeader(TenantDetailData data, NumberFormat fmt) {
    final tenant = data.tenant;
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1A237E), Color(0xFF3949AB)],
        ),
      ),
      padding: const EdgeInsets.fromLTRB(16, 60, 16, 16),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.end,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Avatar
          CircleAvatar(
            radius: 40,
            backgroundColor: Colors.white.withOpacity(0.2),
            child: Text(
              tenant.initials,
              style: const TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
          ),
          const SizedBox(height: 8),
          // Name
          Text(
            tenant.fullName,
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 6),
          // Status badge
          _buildStatusBadge(data.statusBadge),
        ],
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    Color bgColor;
    Color textColor;
    IconData icon;
    String label;

    switch (status) {
      case 'overdue':
        bgColor = Colors.red.withOpacity(0.9);
        textColor = Colors.white;
        icon = Icons.warning_amber_rounded;
        label = 'Overdue';
      case 'moving_out':
        bgColor = Colors.orange.withOpacity(0.9);
        textColor = Colors.white;
        icon = Icons.move_up_rounded;
        label = 'Moving Out';
      default:
        bgColor = Colors.green.withOpacity(0.85);
        textColor = Colors.white;
        icon = Icons.check_circle_rounded;
        label = 'Active';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: textColor),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              color: textColor,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Contact Card
  // ───────────────────────────────────────────────────────────────────────────
  Widget _buildContactCard(TenantDetailData data) {
    final tenant = data.tenant;
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.contact_phone_rounded, size: 20, color: Color(0xFF1A237E)),
                SizedBox(width: 8),
                Text(
                  'Contact Information',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1A237E),
                  ),
                ),
              ],
            ),
            const Divider(height: 20),
            _buildContactRow(
              Icons.phone_rounded,
              tenant.phoneNumber,
              'Call',
              () => _launchPhone(tenant.phoneNumber),
              () => _launchWhatsApp(tenant.phoneNumber),
            ),
            const SizedBox(height: 12),
            _buildSimpleInfoRow(Icons.email_rounded, tenant.email.isNotEmpty ? tenant.email : 'No email'),
            if (tenant.emergencyContact.isNotEmpty) ...[
              const SizedBox(height: 12),
              _buildSimpleInfoRow(Icons.emergency_rounded, 'Emergency: ${tenant.emergencyContact}'),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildContactRow(
    IconData icon,
    String value,
    String actionLabel,
    VoidCallback onCall,
    VoidCallback onWhatsApp,
  ) {
    return Row(
      children: [
        Icon(icon, size: 20, color: Colors.grey[600]),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500),
          ),
        ),
        _QuickActionButton(
          icon: Icons.call_rounded,
          color: Colors.green,
          onTap: onCall,
          tooltip: 'Call',
        ),
        const SizedBox(width: 8),
        _QuickActionButton(
          icon: Icons.chat_rounded,
          color: const Color(0xFF25D366),
          onTap: onWhatsApp,
          tooltip: 'WhatsApp',
        ),
      ],
    );
  }

  Widget _buildSimpleInfoRow(IconData icon, String value) {
    return Row(
      children: [
        Icon(icon, size: 20, color: Colors.grey[600]),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500),
          ),
        ),
      ],
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Lease Summary Card
  // ───────────────────────────────────────────────────────────────────────────
  Widget _buildLeaseCard(TenantDetailData data, NumberFormat fmt) {
    final lease = data.lease;
    final dateFormat = DateFormat('MMM dd, yyyy');

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.description_rounded, size: 20, color: Color(0xFF1A237E)),
                SizedBox(width: 8),
                Text(
                  'Lease Summary',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1A237E),
                  ),
                ),
              ],
            ),
            const Divider(height: 20),

            // Property name & unit
            if (data.propertyDisplayName != 'N/A') ...[
              _buildLeaseRow(Icons.business_rounded, 'Property', data.propertyDisplayName),
              const SizedBox(height: 10),
            ],

            // Lease dates
            _buildLeaseRow(
              Icons.date_range_rounded,
              'Start Date',
              lease.startDate != null
                  ? dateFormat.format(DateTime.parse(lease.startDate!))
                  : 'N/A',
            ),
            const SizedBox(height: 10),
            _buildLeaseRow(
              Icons.event_available_rounded,
              'End Date',
              lease.isPermanent
                  ? 'Ongoing'
                  : dateFormat.format(DateTime.parse(lease.endDate!)),
            ),
            const SizedBox(height: 10),

            // Days remaining
            if (!lease.isPermanent)
              _buildLeaseRow(
                Icons.timer_rounded,
                'Days Remaining',
                lease.isEnded ? 'Lease ended' : '${lease.daysRemaining} days',
                valueColor: lease.daysRemaining != null && lease.daysRemaining! < 30
                    ? Colors.orange
                    : null,
              ),
            if (!lease.isPermanent) const SizedBox(height: 10),

            const Divider(height: 4),

            // Monthly rent & security deposit
            const SizedBox(height: 10),
            _buildLeaseRow(
              Icons.monetization_on_rounded,
              'Monthly Rent',
              fmt.format(lease.monthlyRent),
              valueColor: const Color(0xFF1A237E),
            ),
            const SizedBox(height: 10),
            _buildLeaseRow(
              Icons.savings_rounded,
              'Security Deposit',
              fmt.format(lease.securityDeposit),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLeaseRow(
    IconData icon,
    String label,
    String value, {
    Color? valueColor,
  }) {
    return Row(
      children: [
        Icon(icon, size: 18, color: Colors.grey[500]),
        const SizedBox(width: 12),
        Text(
          label,
          style: TextStyle(
            fontSize: 14,
            color: Colors.grey[600],
          ),
        ),
        const Spacer(),
        Text(
          value,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: valueColor ?? Colors.black87,
          ),
        ),
      ],
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Financial Health Card
  // ───────────────────────────────────────────────────────────────────────────
  Widget _buildFinancialCard(TenantDetailData data, NumberFormat fmt) {
    final financial = data.financial;

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.account_balance_wallet_rounded, size: 20, color: Color(0xFF1A237E)),
                SizedBox(width: 8),
                Text(
                  'Financial Health',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1A237E),
                  ),
                ),
              ],
            ),
            const Divider(height: 20),

            // Outstanding balance (highlighted)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: financial.hasOutstanding
                    ? Colors.red.withOpacity(0.08)
                    : Colors.green.withOpacity(0.08),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Icon(
                    financial.hasOutstanding
                        ? Icons.error_outline_rounded
                        : Icons.check_circle_rounded,
                    color: financial.hasOutstanding ? Colors.red : Colors.green,
                    size: 24,
                  ),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Outstanding Balance',
                        style: TextStyle(
                          fontSize: 13,
                          color: Colors.grey[600],
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        fmt.format(financial.outstandingBalance),
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: financial.hasOutstanding
                              ? Colors.red[800]
                              : Colors.green[800],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Next payment due date
            if (financial.nextPaymentDueDate != null) ...[
              _buildFinancialRow(
                Icons.calendar_today_rounded,
                'Next Payment Due',
                DateFormat('MMM dd, yyyy')
                    .format(DateTime.parse(financial.nextPaymentDueDate!)),
              ),
              const SizedBox(height: 10),
            ],

            // Breakdown
            Row(
              children: [
                Expanded(
                  child: _buildStatChip(
                    'Pending',
                    fmt.format(financial.totalPending),
                    Colors.orange,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildStatChip(
                    'Overdue',
                    fmt.format(financial.totalOverdue),
                    Colors.red,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFinancialRow(IconData icon, String label, String value) {
    return Row(
      children: [
        Icon(icon, size: 18, color: Colors.grey[500]),
        const SizedBox(width: 12),
        Text(
          label,
          style: TextStyle(fontSize: 14, color: Colors.grey[600]),
        ),
        const Spacer(),
        Text(
          value,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }

  Widget _buildStatChip(String label, String value, MaterialColor color) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: color[700],
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: Colors.grey[600],
            ),
          ),
        ],
      ),
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Recent Transactions Section
  // ───────────────────────────────────────────────────────────────────────────
  Widget _buildRecentTransactionsSection(
      TenantDetailData data, NumberFormat fmt) {
    final transactions = data.recentTransactions;

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.receipt_long_rounded, size: 20, color: Color(0xFF1A237E)),
                SizedBox(width: 8),
                Text(
                  'Recent Transactions',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1A237E),
                  ),
                ),
              ],
            ),
            const Divider(height: 20),

            if (transactions.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: Center(
                  child: Column(
                    children: [
                      Icon(Icons.receipt_long_outlined,
                          size: 40, color: Colors.grey[300]),
                      const SizedBox(height: 8),
                      Text(
                        'No transactions yet',
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.grey[500],
                        ),
                      ),
                    ],
                  ),
                ),
              )
            else
              ...transactions.map(
                (entry) => _buildTransactionItem(entry, fmt),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildTransactionItem(RentLedgerEntry entry, NumberFormat fmt) {
    MaterialColor? statusColor;
    IconData statusIcon;
    String statusLabel;

    switch (entry.paymentStatus) {
      case 'paid':
        statusColor = Colors.green;
        statusIcon = Icons.check_circle_rounded;
        statusLabel = 'Paid';
      case 'overdue':
        statusColor = Colors.red;
        statusIcon = Icons.warning_rounded;
        statusLabel = 'Overdue';
      case 'partial':
        statusColor = Colors.orange;
        statusIcon = Icons.hourglass_bottom_rounded;
        statusLabel = 'Partial';
      default:
        statusColor = Colors.grey;
        statusIcon = Icons.schedule_rounded;
        statusLabel = 'Pending';
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          // Status indicator
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: statusColor.withOpacity(0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(statusIcon, color: statusColor, size: 20),
          ),
          const SizedBox(width: 12),
          // Period and date
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.periodLabel,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if (entry.rentDueDate != null)
                  Text(
                    'Due: ${DateFormat('MMM dd').format(DateTime.parse(entry.rentDueDate!))}',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey[500],
                    ),
                  ),
              ],
            ),
          ),
          // Amount and status
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                fmt.format(entry.amountPaid > 0 ? entry.amountPaid : entry.amountDue),
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: statusColor.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  statusLabel,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: statusColor[700],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Bottom Action Bar
  // ───────────────────────────────────────────────────────────────────────────
  Widget _buildBottomActionBar(BuildContext context, TenantDetailData data) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 12,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            // Record Payment
            Expanded(
              child: FilledButton.icon(
                onPressed: () => _onRecordPayment(context, data),
                icon: const Icon(Icons.payments_rounded, size: 20),
                label: const Text('Record Payment'),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF1A237E),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            // Edit Details
            OutlinedButton.icon(
              onPressed: () => _onEditDetails(context, data),
              icon: const Icon(Icons.edit_rounded, size: 20),
              label: const Text('Edit'),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF1A237E),
                side: const BorderSide(color: Color(0xFF1A237E)),
                padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Action Handlers
  // ───────────────────────────────────────────────────────────────────────────
  void _showActionMenu(BuildContext context, TenantDetailData data) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Renew / Terminate Lease
              ListTile(
                leading: const Icon(Icons.autorenew_rounded,
                    color: Color(0xFF1A237E)),
                title: const Text('Renew Lease'),
                subtitle: const Text('Extend the tenancy period'),
                onTap: () {
                  Navigator.pop(ctx);
                  // TODO: Navigate to lease renewal flow
                },
              ),
              ListTile(
                leading:
                    const Icon(Icons.cancel_outlined, color: Colors.red),
                title: const Text('Terminate Lease',
                    style: TextStyle(color: Colors.red)),
                subtitle:
                    const Text('End the tenancy and move out'),
                onTap: () {
                  Navigator.pop(ctx);
                  _confirmTerminateLease(context, data);
                },
              ),
              const Divider(),
              ListTile(
                leading: const Icon(Icons.share_rounded,
                    color: Colors.grey),
                title: const Text('Share Details'),
                onTap: () {
                  Navigator.pop(ctx);
                  // TODO: Share tenant details
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _onRecordPayment(BuildContext context, TenantDetailData data) {
    // TODO: Navigate to the payment recording screen
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Record Payment — coming soon')),
    );
  }

  void _onEditDetails(BuildContext context, TenantDetailData data) {
    // TODO: Navigate to the edit tenant screen
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Edit Details — coming soon')),
    );
  }

  void _confirmTerminateLease(BuildContext context, TenantDetailData data) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Terminate Lease?'),
        content: Text(
          'Are you sure you want to terminate the lease for ${data.tenant.fullName}? '
          'This action will mark the tenant as moved out.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              // TODO: Call backend to mark as moved out
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Lease termination initiated')),
              );
            },
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Terminate'),
          ),
        ],
      ),
    );
  }

  Future<void> _launchPhone(String phone) async {
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  Future<void> _launchWhatsApp(String phone) async {
    // Remove any non-digit characters
    final cleanPhone = phone.replaceAll(RegExp(r'\D'), '');
    final uri = Uri.parse('https://wa.me/$cleanPhone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick Action Button (Call / WhatsApp)
// ─────────────────────────────────────────────────────────────────────────────
class _QuickActionButton extends StatelessWidget {
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
  final String tooltip;

  const _QuickActionButton({
    required this.icon,
    required this.color,
    required this.onTap,
    required this.tooltip,
  });

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: color.withOpacity(0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, size: 18, color: color),
        ),
      ),
    );
  }
}
