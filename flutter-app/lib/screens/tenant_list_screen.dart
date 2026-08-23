import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/tenant.dart';
import '../navigation/app_routes.dart';
import '../providers/tenant_list_provider.dart';

/// Home screen — lists tenants fetched from the backend.
class TenantListScreen extends StatefulWidget {
  const TenantListScreen({super.key});

  @override
  State<TenantListScreen> createState() => _TenantListScreenState();
}

class _TenantListScreenState extends State<TenantListScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<TenantListProvider>().fetchTenants();
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<TenantListProvider>();
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tenants'),
        backgroundColor: const Color(0xFF1A237E),
        foregroundColor: Colors.white,
      ),
      body: _buildBody(provider),
    );
  }

  Widget _buildBody(TenantListProvider provider) {
    if (provider.loading && provider.tenants.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (provider.error != null && provider.tenants.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                provider.error!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.redAccent),
              ),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: () =>
                    context.read<TenantListProvider>().fetchTenants(),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    if (provider.tenants.isEmpty) {
      return const Center(child: Text('No tenants found.'));
    }

    return RefreshIndicator(
      onRefresh: () => context.read<TenantListProvider>().fetchTenants(),
      child: ListView.separated(
        itemCount: provider.tenants.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (context, index) =>
            _TenantCard(tenant: provider.tenants[index]),
      ),
    );
  }
}

class _TenantCard extends StatelessWidget {
  final Tenant tenant;

  const _TenantCard({required this.tenant});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: CircleAvatar(
        backgroundColor: const Color(0xFF1A237E),
        foregroundColor: Colors.white,
        child: Text(tenant.initials),
      ),
      title: Text(tenant.fullName),
      subtitle: Text(tenant.phoneNumber),
      trailing: Text('\$${tenant.monthlyRent.toStringAsFixed(0)}/mo'),
      onTap: () =>
          AppRoutes.navigateToTenantDetail(context, tenantId: tenant.id),
    );
  }
}
