import 'package:flutter/foundation.dart';
import '../models/tenant_detail_model.dart';
import '../services/tenant_detail_service.dart';

/// View state for the tenant detail screen.
enum TenantDetailState {
  initial,
  loading,
  loaded,
  error,
}

/// Provider that manages the tenant detail view state,
/// handling loading, success, and error states.
class TenantDetailProvider extends ChangeNotifier {
  final TenantDetailService _service;

  TenantDetailProvider({TenantDetailService? service})
      : _service = service ?? TenantDetailService();

  TenantDetailState _state = TenantDetailState.initial;
  TenantDetailData? _data;
  String? _errorMessage;
  String? _currentTenantId;

  // Getters
  TenantDetailState get state => _state;
  TenantDetailData? get data => _data;
  String? get errorMessage => _errorMessage;
  bool get isLoading => _state == TenantDetailState.loading;
  bool get hasError => _state == TenantDetailState.error;
  bool get hasData => _state == TenantDetailState.loaded && _data != null;

  /// Fetches tenant details by ID.
  ///
  /// Can be called from the list view when tapping a tenant item.
  Future<void> fetchTenantById(String tenantId) async {
    _currentTenantId = tenantId;
    _state = TenantDetailState.loading;
    _errorMessage = null;
    notifyListeners();

    try {
      final result = await _service.fetchTenantById(tenantId);
      _data = result;
      _state = TenantDetailState.loaded;
    } on TenantDetailException catch (e) {
      _errorMessage = e.message;
      _state = TenantDetailState.error;
    } catch (e) {
      _errorMessage = 'Something went wrong. Please try again.';
      _state = TenantDetailState.error;
    }

    notifyListeners();
  }

  /// Retry the last failed fetch.
  Future<void> retry() async {
    if (_currentTenantId != null) {
      await fetchTenantById(_currentTenantId!);
    }
  }

  /// Reset to initial state.
  void reset() {
    _state = TenantDetailState.initial;
    _data = null;
    _errorMessage = null;
    _currentTenantId = null;
    notifyListeners();
  }
}
