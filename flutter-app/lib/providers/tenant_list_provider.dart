import 'package:flutter/foundation.dart';
import '../models/tenant.dart';
import '../services/tenant_list_service.dart';

/// Manages the tenant list view state.
class TenantListProvider extends ChangeNotifier {
  final TenantListService _service;

  TenantListProvider({TenantListService? service})
      : _service = service ?? TenantListService();

  List<Tenant> _tenants = [];
  bool _loading = false;
  String? _error;

  List<Tenant> get tenants => _tenants;
  bool get loading => _loading;
  String? get error => _error;

  Future<void> fetchTenants() async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      _tenants = await _service.fetchTenants();
    } catch (e) {
      _error = e.toString();
    }

    _loading = false;
    notifyListeners();
  }
}
