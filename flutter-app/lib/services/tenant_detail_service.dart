import 'package:dio/dio.dart';
import '../models/tenant_detail_model.dart';
import 'api_client.dart';

/// Service responsible for fetching tenant detail data from the backend.
class TenantDetailService {
  final ApiClient _client;

  TenantDetailService({ApiClient? client})
      : _client = client ?? ApiClient.instance;

  /// Fetches full tenant details by tenant ID.
  ///
  /// Throws [TenantDetailException] on API or network errors.
  /// Returns [TenantDetailData] on success.
  Future<TenantDetailData> fetchTenantById(String tenantId) async {
    try {
      final response = await _client.get('/tenants/$tenantId/details');

      if (response.statusCode == 200 && response.data != null) {
        final parsed =
            TenantDetailResponse.fromJson(response.data as Map<String, dynamic>);

        if (parsed.success && parsed.data != null) {
          return parsed.data!;
        }

        throw TenantDetailException(
          message: 'Failed to load tenant details',
          statusCode: response.statusCode,
        );
      }

      throw TenantDetailException(
        message: 'Unexpected response: ${response.statusCode}',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout) {
        throw TenantDetailException(
          message: 'Connection timed out. Please check your network.',
          isNetworkError: true,
        );
      } else if (e.type == DioExceptionType.connectionError) {
        throw TenantDetailException(
          message: 'Cannot reach the server. Please try again later.',
          isNetworkError: true,
        );
      } else if (e.response?.statusCode == 404) {
        throw TenantDetailException(
          message: 'Tenant not found.',
          statusCode: 404,
        );
      } else if (e.response?.statusCode == 403) {
        throw TenantDetailException(
          message: 'You do not have access to this tenant.',
          statusCode: 403,
        );
      }
      throw TenantDetailException(
        message: e.message ?? 'An unexpected error occurred.',
        isNetworkError: true,
      );
    } catch (e) {
      throw TenantDetailException(
        message: 'Failed to load tenant details: $e',
      );
    }
  }
}

/// Custom exception for tenant detail fetch failures.
class TenantDetailException implements Exception {
  final String message;
  final int? statusCode;
  final bool isNetworkError;

  TenantDetailException({
    required this.message,
    this.statusCode,
    this.isNetworkError = false,
  });

  @override
  String toString() => 'TenantDetailException: $message';
}
