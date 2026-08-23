import 'package:dio/dio.dart';
import '../models/tenant.dart';
import 'api_client.dart';

/// Fetches the tenant list from the backend.
class TenantListService {
  final ApiClient _client;

  TenantListService({ApiClient? client}) : _client = client ?? ApiClient.instance;

  /// Fetches all tenants from `GET /tenants`.
  Future<List<Tenant>> fetchTenants() async {
    try {
      final response = await _client.get('/tenants');

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data as Map<String, dynamic>;
        if (data['success'] == true) {
          return (data['data'] as List<dynamic>? ?? [])
              .map((e) => Tenant.fromJson(e as Map<String, dynamic>))
              .toList();
        }
        throw TenantListException(
            message: data['error']?.toString() ?? 'Failed to load tenants');
      }
      throw TenantListException(
          message: 'Unexpected response: ${response.statusCode}');
    } on DioException catch (e) {
      throw TenantListException(message: e.message ?? 'Network error');
    } catch (e) {
      throw TenantListException(message: 'Failed to load tenants: $e');
    }
  }
}

class TenantListException implements Exception {
  final String message;

  TenantListException({required this.message});

  @override
  String toString() => 'TenantListException: $message';
}
